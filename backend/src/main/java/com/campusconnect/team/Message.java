package com.campusconnect.team;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;
    private Long senderId;
    private String content;
    private Instant createdAt = Instant.now();

    protected Message() {
    }

    public Message(Long projectId, Long senderId, String content) {
        this.projectId = projectId;
        this.senderId = senderId;
        this.content = content;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public Long getSenderId() { return senderId; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
}
