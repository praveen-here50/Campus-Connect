package com.campusconnect.project;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;
    private String title;
    private String status = "TODO";
    private Long assigneeId;
    private Instant createdAt = Instant.now();

    protected Task() {
    }

    public Task(Long projectId, String title) {
        this.projectId = projectId;
        this.title = title;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getAssigneeId() { return assigneeId; }
    public void setAssigneeId(Long assigneeId) { this.assigneeId = assigneeId; }
    public Instant getCreatedAt() { return createdAt; }
}
