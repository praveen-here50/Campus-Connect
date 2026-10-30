package com.campusconnect.ai;

import com.campusconnect.common.AfterCommit;
import com.campusconnect.notification.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Screens new knowledge-hub posts with the LLM in the background. Flagged posts are hidden from
 * everyone but their author. If AI is off or busy, posts simply stay visible.
 */
@Service
public class ModerationService {

    public record Verdict(boolean flagged, String reason) {
    }

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);

    private static final String SYSTEM = """
        You moderate a university students' knowledge-sharing forum. Flag a post ONLY if it contains
        harassment, hate speech, sexual content, spam/advertising, personal data of others, or requests
        to cheat on graded exams/assignments. Technical questions, opinions, and beginner questions are fine.
        Respond with flagged=true/false and a one-sentence reason.
        """;

    private final AiClient ai;
    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    public ModerationService(AiClient ai, JdbcTemplate jdbc, NotificationService notifications) {
        this.ai = ai;
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    public void screenPostAfterCommit(long postId, long authorId, String title, String body) {
        AfterCommit.runAsync(() -> {
            if (!ai.tryAcquire()) {
                return;
            }
            try {
                Verdict v = ai.entityUnmetered(SYSTEM, "Title: " + title + "\n\n" + body, Verdict.class);
                if (v != null && v.flagged()) {
                    jdbc.update("update posts set flagged = true where id = ?", postId);
                    notifications.notify(authorId, "POST_FLAGGED",
                        "Your post \"" + title + "\" was hidden by moderation: " + v.reason(), "/knowledge/" + postId);
                }
            } catch (Exception e) {
                log.warn("Moderation of post {} failed: {}", postId, e.getMessage());
            }
        });
    }
}
