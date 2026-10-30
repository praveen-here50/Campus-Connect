package com.campusconnect.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private String type;
    private String message;
    private String link;

    @Column(name = "is_read")
    private boolean read;

    private Instant createdAt = Instant.now();

    protected Notification() {
    }

    public Notification(Long userId, String type, String message, String link) {
        this.userId = userId;
        this.type = type;
        this.message = message;
        this.link = link;
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getType() { return type; }
    public String getMessage() { return message; }
    public String getLink() { return link; }
    public boolean isRead() { return read; }
    public void markRead() { this.read = true; }
    public Instant getCreatedAt() { return createdAt; }
}
