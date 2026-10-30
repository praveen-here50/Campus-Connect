package com.campusconnect.automation;

import com.campusconnect.common.AfterCommit;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Forwards domain events to the n8n webhook (welcome emails, digests, ...).
 * Requests carry X-Api-Key (AUTOMATION_API_KEY) so the workflow can reject forged calls.
 * A no-op when N8N_WEBHOOK_URL is not set.
 */
@Service
public class AutomationEvents {

    private static final Logger log = LoggerFactory.getLogger(AutomationEvents.class);

    private final String webhookUrl;
    private final String apiKey;
    private final RestClient http = RestClient.create();

    public AutomationEvents(@Value("${app.automation.n8n-webhook-url}") String webhookUrl,
                            @Value("${app.automation.api-key}") String apiKey) {
        this.webhookUrl = webhookUrl;
        this.apiKey = apiKey;
    }

    public void publish(String event, Map<String, ?> data) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            return;
        }
        Map<String, Object> body = Map.of("event", event, "occurredAt", Instant.now().toString(), "data", data);
        AfterCommit.runAsync(() -> {
            try {
                http.post().uri(webhookUrl).contentType(MediaType.APPLICATION_JSON)
                    .header("X-Api-Key", apiKey == null ? "" : apiKey).body(body)
                    .retrieve().toBodilessEntity();
            } catch (Exception e) {
                log.warn("Could not deliver automation event {}: {}", event, e.getMessage());
            }
        });
    }
}
