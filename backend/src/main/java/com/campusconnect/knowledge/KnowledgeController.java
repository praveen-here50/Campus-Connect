package com.campusconnect.knowledge;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.knowledge.KnowledgeService.CommentView;
import com.campusconnect.knowledge.KnowledgeService.PostDetail;
import com.campusconnect.knowledge.KnowledgeService.PostView;
import com.campusconnect.knowledge.KnowledgeService.SaveComment;
import com.campusconnect.knowledge.KnowledgeService.SavePost;
import com.campusconnect.knowledge.KnowledgeService.TagCount;
import com.campusconnect.knowledge.KnowledgeService.VoteResult;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class KnowledgeController {

    private final KnowledgeService service;

    public KnowledgeController(KnowledgeService service) {
        this.service = service;
    }

    @GetMapping("/posts")
    List<PostView> search(@AuthenticationPrincipal Jwt jwt,
                          @RequestParam(required = false) String q,
                          @RequestParam(required = false) String tag,
                          @RequestParam(required = false) Long author,
                          @RequestParam(defaultValue = "new") String sort) {
        return service.search(q, tag, author, sort, CurrentUser.id(jwt));
    }

    @GetMapping("/posts/semantic")
    List<PostView> semantic(@AuthenticationPrincipal Jwt jwt, @RequestParam String q) {
        return service.semantic(q, CurrentUser.id(jwt));
    }

    @GetMapping("/posts/tags")
    List<TagCount> tags() {
        return service.popularTags();
    }

    @PostMapping("/posts")
    @ResponseStatus(HttpStatus.CREATED)
    PostDetail create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SavePost req) {
        return service.create(CurrentUser.id(jwt), req);
    }

    @GetMapping("/posts/{id}")
    PostDetail get(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.get(id, CurrentUser.id(jwt));
    }

    @DeleteMapping("/posts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        service.delete(id, CurrentUser.id(jwt));
    }

    @PostMapping("/posts/{id}/vote")
    VoteResult vote(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.toggleVote(id, CurrentUser.id(jwt));
    }

    @PostMapping("/posts/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    CommentView comment(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                        @Valid @RequestBody SaveComment req) {
        return service.comment(id, CurrentUser.id(jwt), req);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        service.deleteComment(id, CurrentUser.id(jwt));
    }
}
