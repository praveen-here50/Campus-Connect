package com.campusconnect.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Calls the /embeddings endpoint of an OpenAI-compatible provider directly. Spring AI's OpenAI
 * embedding model requires the "index" and "usage" fields, which Gemini's compatible endpoint
 * leaves out, so every embedding failed; this client only reads the vector.
 */
@Component
public class EmbeddingClient {

    private final RestClient http;
    private final String model;
    private final int dimensions;

    public EmbeddingClient(@Value("${spring.ai.openai.base-url}") String baseUrl,
                           @Value("${spring.ai.openai.api-key}") String apiKey,
                           @Value("${spring.ai.openai.embedding.options.model}") String model,
                           @Value("${spring.ai.openai.embedding.options.dimensions}") int dimensions) {
        this.http = RestClient.builder()
            .baseUrl(baseUrl.endsWith("/") ? baseUrl : baseUrl + "/")
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .build();
        this.model = model;
        this.dimensions = dimensions;
    }

    public float[] embed(String text) {
        Response response = http.post().uri("embeddings")
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("model", model, "input", text, "dimensions", dimensions))
            .retrieve()
            .body(Response.class);
        if (response == null || response.data() == null || response.data().isEmpty()) {
            throw new IllegalStateException("The embedding response had no data");
        }
        float[] vector = response.data().getFirst().embedding();
        if (vector == null || vector.length != dimensions) {
            throw new IllegalStateException("Expected a " + dimensions + "-dimensional embedding, got "
                + (vector == null ? "none" : vector.length));
        }
        return vector;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Response(List<Item> data) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Item(float[] embedding) {
    }
}
