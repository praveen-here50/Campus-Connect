package com.campusconnect.ai;

import com.campusconnect.common.Errors;
import java.util.ArrayDeque;
import java.util.Deque;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Single entry point for LLM calls. Free-tier keys allow only a few requests per minute, so calls
 * share one sliding-window limit (app.ai.requests-per-minute) across the whole app.
 */
@Component
public class AiClient {

    private final ChatClient chat;
    private final boolean enabled;
    private final int perMinute;
    private final Deque<Long> recent = new ArrayDeque<>();

    public AiClient(ChatClient.Builder builder, @Value("${spring.ai.openai.api-key}") String apiKey,
                    @Value("${app.ai.requests-per-minute}") int perMinute) {
        this.chat = builder.build();
        this.enabled = !"missing".equals(apiKey);
        this.perMinute = perMinute;
    }

    public boolean enabled() {
        return enabled;
    }

    /** For user-facing calls: fails with 503/429 instead of waiting. */
    public <T> T entity(String system, String user, Class<T> type) {
        acquireOrThrow();
        return chat.prompt().system(system).user(user).call().entity(type);
    }

    public String text(String system, String user) {
        acquireOrThrow();
        return chat.prompt().system(system).user(user).call().content();
    }

    /** For background work: returns false (and does nothing) when AI is off or the budget is used up. */
    public boolean tryAcquire() {
        if (!enabled) {
            return false;
        }
        synchronized (recent) {
            long now = System.currentTimeMillis();
            while (!recent.isEmpty() && now - recent.peekFirst() > 60_000) {
                recent.pollFirst();
            }
            if (recent.size() >= perMinute) {
                return false;
            }
            recent.addLast(now);
            return true;
        }
    }

    public <T> T entityUnmetered(String system, String user, Class<T> type) {
        return chat.prompt().system(system).user(user).call().entity(type);
    }

    private void acquireOrThrow() {
        if (!enabled) {
            throw Errors.unavailable("AI features are not configured on this server");
        }
        if (!tryAcquire()) {
            throw Errors.tooManyRequests("The AI assistant is busy, please try again in a minute");
        }
    }
}
