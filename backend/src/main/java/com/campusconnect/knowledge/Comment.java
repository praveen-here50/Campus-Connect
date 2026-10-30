package com.campusconnect.knowledge;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long postId;
    private Long authorId;
    private String body;
    private Instant createdAt = Instant.now();

    protected Comment() {
    }

    public Comment(Long postId, Long authorId, String body) {
        this.postId = postId;
        this.authorId = authorId;
        this.body = body;
    }

    public Long getId() { return id; }
    public Long getPostId() { return postId; }
    public Long getAuthorId() { return authorId; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
