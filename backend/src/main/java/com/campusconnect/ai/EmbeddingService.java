package com.campusconnect.ai;

import com.campusconnect.common.AfterCommit;
import java.util.List;
import java.util.function.LongFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Keeps the pgvector embeddings of users, projects and posts in sync with their text.
 * Embedding is best-effort: a failed or unconfigured AI call never breaks the request.
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final EmbeddingClient client;
    private final JdbcTemplate jdbc;
    private final boolean enabled;

    public EmbeddingService(EmbeddingClient client, JdbcTemplate jdbc,
                            @Value("${spring.ai.openai.api-key}") String apiKey) {
        this.client = client;
        this.jdbc = jdbc;
        this.enabled = !"missing".equals(apiKey);
    }

    public void refreshUserAfterCommit(long userId) {
        refreshAfterCommit("users", userId, this::userText);
    }

    public void refreshProjectAfterCommit(long projectId) {
        refreshAfterCommit("projects", projectId, this::projectText);
    }

    public void refreshPostAfterCommit(long postId) {
        refreshAfterCommit("posts", postId, this::postText);
    }

    /**
     * Rows written while AI was not configured have no embedding; once a key is added they are
     * filled in on the next start, in the background, so matching and semantic search see them.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void backfillMissing() {
        if (!enabled) {
            return;
        }
        AfterCommit.runAsync(() -> {
            int done = backfill("users", this::userText) + backfill("projects", this::projectText)
                + backfill("posts", this::postText);
            if (done > 0) {
                log.info("Backfilled {} missing embeddings", done);
            }
        });
    }

    private int backfill(String table, LongFunction<String> text) {
        int done = 0;
        for (long id : jdbc.queryForList("select id from " + table + " where embedding is null order by id", Long.class)) {
            try {
                store(table, id, text);
                done++;
            } catch (Exception e) {
                log.warn("Could not backfill embedding for {} {}: {}", table, id, e.getMessage());
            }
        }
        return done;
    }

    private String userText(long userId) {
        String profile = jdbc.queryForObject("""
            select concat_ws('. ', full_name, headline, department, bio) from users where id = ?
            """, String.class, userId);
        List<String> skills = jdbc.queryForList(
            "select skill from user_skills where user_id = ?", String.class, userId);
        return profile + ". Skills: " + String.join(", ", skills);
    }

    private String projectText(long projectId) {
        String project = jdbc.queryForObject("""
            select concat_ws('. ', title, category, description) from projects where id = ?
            """, String.class, projectId);
        List<String> skills = jdbc.queryForList(
            "select skill from project_skills where project_id = ?", String.class, projectId);
        return project + ". Needs: " + String.join(", ", skills);
    }

    private String postText(long postId) {
        return jdbc.queryForObject("""
            select concat_ws('. ', title, array_to_string(tags, ', '), body) from posts where id = ?
            """, String.class, postId);
    }

    /** Embeds a free-text query for semantic search; null when AI is not configured. */
    public float[] embed(String text) {
        return enabled ? client.embed(text) : null;
    }

    /** Ids of the rows of a table whose embedding is closest to the text, nearest first. */
    public List<Long> nearest(String table, String text, String extraWhere, int limit) {
        float[] vector = embed(text);
        if (vector == null) {
            return List.of();
        }
        return jdbc.queryForList("select id from " + table + " where embedding is not null"
            + (extraWhere == null ? "" : " and " + extraWhere)
            + " order by embedding <=> ?::vector limit ?", Long.class, toVectorLiteral(vector), limit);
    }

    public static String toVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(vector[i]);
        }
        return sb.append(']').toString();
    }

    private void refreshAfterCommit(String table, long id, LongFunction<String> text) {
        if (!enabled) {
            return;
        }
        AfterCommit.runAsync(() -> {
            try {
                store(table, id, text);
            } catch (Exception e) {
                log.warn("Could not refresh embedding for {} {}: {}", table, id, e.getMessage());
            }
        });
    }

    private void store(String table, long id, LongFunction<String> text) {
        float[] vector = client.embed(text.apply(id));
        jdbc.update("update " + table + " set embedding = ?::vector where id = ?", toVectorLiteral(vector), id);
    }
}
