package com.campusconnect.knowledge;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long authorId;
    private String title;
    private String body;

    /** lower-case tags */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private List<String> tags = new ArrayList<>();

    private int upvotes;
    private boolean flagged;
    private Instant createdAt = Instant.now();

    protected Post() {
    }

    public Post(Long authorId, String title, String body, List<String> tags) {
        this.authorId = authorId;
        this.title = title;
        this.body = body;
        this.tags = tags;
    }

    public Long getId() { return id; }
    public Long getAuthorId() { return authorId; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public List<String> getTags() { return tags; }
    public int getUpvotes() { return upvotes; }
    public boolean isFlagged() { return flagged; }
    public Instant getCreatedAt() { return createdAt; }
}
