package com.campusconnect.project;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A request to join a project. APPLY: the student asked, the owner decides.
 * INVITE: the owner asked, the student decides.
 */
@Entity
@Table(name = "applications")
public class Application {

    public static final String APPLY = "APPLY";
    public static final String INVITE = "INVITE";
    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";
    public static final String REJECTED = "REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;
    private Long userId;
    private String kind;
    private String message;
    private String status = PENDING;
    private Instant createdAt = Instant.now();

    protected Application() {
    }

    public Application(Long projectId, Long userId, String kind, String message) {
        this.projectId = projectId;
        this.userId = userId;
        this.kind = kind;
        this.message = message;
    }

    /** Re-opens a previously decided request (the table allows one row per project and user). */
    public void reopen(String kind, String message) {
        this.kind = kind;
        this.message = message;
        this.status = PENDING;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public Long getUserId() { return userId; }
    public String getKind() { return kind; }
    public String getMessage() { return message; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
