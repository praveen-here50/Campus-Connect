package com.campusconnect.knowledge;

import com.campusconnect.ai.EmbeddingService;
import com.campusconnect.ai.ModerationService;
import com.campusconnect.common.Errors;
import com.campusconnect.notification.NotificationService;
import com.campusconnect.user.User;
import com.campusconnect.user.UserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The knowledge hub: posts, comments, upvotes and semantic search. */
@Service
public class KnowledgeService {

    public record Author(long id, String fullName, String headline) {
    }

    public record PostView(long id, String title, String body, List<String> tags, int upvotes, long comments,
                           Author author, boolean votedByMe, boolean flagged, Instant createdAt) {
    }

    public record CommentView(long id, long postId, Author author, String body, Instant createdAt) {
    }

    public record PostDetail(PostView post, List<CommentView> comments) {
    }

    public record SavePost(@NotBlank @Size(max = 200) String title,
                           @NotBlank @Size(max = 20000) String body,
                           @Size(max = 8) List<@NotBlank @Size(max = 30) String> tags) {
    }

    public record SaveComment(@NotBlank @Size(max = 5000) String body) {
    }

    public record VoteResult(int upvotes, boolean voted) {
    }

    public record TagCount(String tag, long count) {
    }

    private static final int EXCERPT = 280;

    private final PostRepository posts;
    private final CommentRepository comments;
    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final EmbeddingService embeddings;
    private final ModerationService moderation;
    private final NotificationService notifications;

    public KnowledgeService(PostRepository posts, CommentRepository comments, UserRepository users,
                            JdbcTemplate jdbc, EmbeddingService embeddings, ModerationService moderation,
                            NotificationService notifications) {
        this.posts = posts;
        this.comments = comments;
        this.users = users;
        this.jdbc = jdbc;
        this.embeddings = embeddings;
        this.moderation = moderation;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<PostView> search(String q, String tag, Long author, String sort, long viewer) {
        return views(posts.search(q == null ? "" : q.trim(), tag == null || tag.isBlank() ? "" : normalizeTag(tag),
            author == null ? 0 : author,
            "top".equals(sort) ? "top" : "new", viewer), viewer, true);
    }

    /** Finds posts by meaning rather than keywords; falls back to keyword search without AI. */
    @Transactional(readOnly = true)
    public List<PostView> semantic(String q, long viewer) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        List<Long> ids;
        try {
            ids = embeddings.nearest("posts", q, "not flagged", 10);
        } catch (Exception e) {
            ids = List.of();
        }
        if (ids.isEmpty()) {
            return search(q, null, null, "top", viewer);
        }
        Map<Long, Post> byId = posts.findAllById(ids).stream().collect(Collectors.toMap(Post::getId, Function.identity()));
        return views(ids.stream().map(byId::get).filter(p -> p != null).toList(), viewer, true);
    }

    @Transactional(readOnly = true)
    public PostDetail get(long postId, long viewer) {
        Post p = visible(postId, viewer);
        List<Comment> list = comments.findByPostIdOrderByCreatedAt(postId);
        Map<Long, Author> authors = authors(list.stream().map(Comment::getAuthorId).toList());
        return new PostDetail(views(List.of(p), viewer, false).getFirst(),
            list.stream().map(c -> commentView(c, authors.get(c.getAuthorId()))).toList());
    }

    @Transactional
    public PostDetail create(long authorId, SavePost req) {
        List<String> tags = req.tags() == null ? List.of()
            : req.tags().stream().map(KnowledgeService::normalizeTag).distinct().toList();
        Post p = posts.save(new Post(authorId, req.title().trim(), req.body().trim(), new ArrayList<>(tags)));
        embeddings.refreshPostAfterCommit(p.getId());
        moderation.screenPostAfterCommit(p.getId(), authorId, p.getTitle(), p.getBody());
        return new PostDetail(views(List.of(p), authorId, false).getFirst(), List.of());
    }

    @Transactional
    public void delete(long postId, long userId) {
        Post p = posts.findById(postId).orElseThrow(() -> Errors.notFound("Post"));
        if (p.getAuthorId() != userId) {
            throw Errors.forbidden("Only the author can delete this post");
        }
        posts.delete(p);
    }

    @Transactional
    public VoteResult toggleVote(long postId, long userId) {
        Post p = visible(postId, userId);
        boolean voted = jdbc.update("insert into post_votes (post_id, user_id) values (?, ?) on conflict do nothing",
            postId, userId) == 1;
        if (!voted) {
            jdbc.update("delete from post_votes where post_id = ? and user_id = ?", postId, userId);
        }
        Integer upvotes = jdbc.queryForObject(
            "update posts set upvotes = (select count(*) from post_votes where post_id = ?) where id = ? returning upvotes",
            Integer.class, postId, postId);
        if (voted && p.getAuthorId() != userId) {
            notifications.notify(p.getAuthorId(), "UPVOTE", nameOf(userId) + " upvoted \"" + p.getTitle() + "\"",
                "/knowledge/" + postId);
        }
        return new VoteResult(upvotes == null ? 0 : upvotes, voted);
    }

    @Transactional
    public CommentView comment(long postId, long userId, SaveComment req) {
        Post p = visible(postId, userId);
        Comment c = comments.save(new Comment(postId, userId, req.body().trim()));
        if (p.getAuthorId() != userId) {
            notifications.notify(p.getAuthorId(), "COMMENT", nameOf(userId) + " answered \"" + p.getTitle() + "\"",
                "/knowledge/" + postId);
        }
        return commentView(c, authors(List.of(userId)).get(userId));
    }

    /** The comment's author or the post's author may delete a comment. */
    @Transactional
    public void deleteComment(long commentId, long userId) {
        Comment c = comments.findById(commentId).orElseThrow(() -> Errors.notFound("Comment"));
        long postAuthor = posts.findById(c.getPostId()).map(Post::getAuthorId).orElse(-1L);
        if (c.getAuthorId() != userId && postAuthor != userId) {
            throw Errors.forbidden("You cannot delete this comment");
        }
        comments.delete(c);
    }

    @Transactional(readOnly = true)
    public List<TagCount> popularTags() {
        return jdbc.query("""
            select t, count(*) as n from posts, unnest(tags) as t
            where not flagged group by t order by n desc, t limit 15
            """, (rs, i) -> new TagCount(rs.getString("t"), rs.getLong("n")));
    }

    private Post visible(long postId, long viewer) {
        return posts.findById(postId)
            .filter(p -> !p.isFlagged() || p.getAuthorId() == viewer)
            .orElseThrow(() -> Errors.notFound("Post"));
    }

    private List<PostView> views(List<Post> list, long viewer, boolean excerpt) {
        if (list.isEmpty()) {
            return List.of();
        }
        List<Long> ids = list.stream().map(Post::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : comments.countByPostIds(ids)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        Set<Long> voted = new HashSet<>(jdbc.queryForList(
            "select post_id from post_votes where user_id = ? and post_id = any(?)", Long.class, viewer,
            ids.toArray(new Long[0])));
        Map<Long, Author> authors = authors(list.stream().map(Post::getAuthorId).toList());
        return list.stream().map(p -> new PostView(p.getId(), p.getTitle(),
            excerpt && p.getBody().length() > EXCERPT ? p.getBody().substring(0, EXCERPT) + "…" : p.getBody(),
            p.getTags(), p.getUpvotes(), counts.getOrDefault(p.getId(), 0L), authors.get(p.getAuthorId()),
            voted.contains(p.getId()), p.isFlagged(), p.getCreatedAt())).toList();
    }

    private Map<Long, Author> authors(Collection<Long> ids) {
        return users.findAllById(ids.stream().distinct().toList()).stream()
            .collect(Collectors.toMap(User::getId, u -> new Author(u.getId(), u.getFullName(), u.getHeadline())));
    }

    private String nameOf(long userId) {
        return users.findById(userId).map(User::getFullName).orElse("Someone");
    }

    private static CommentView commentView(Comment c, Author author) {
        return new CommentView(c.getId(), c.getPostId(), author, c.getBody(), c.getCreatedAt());
    }

    private static String normalizeTag(String tag) {
        return tag.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "-");
    }

}
