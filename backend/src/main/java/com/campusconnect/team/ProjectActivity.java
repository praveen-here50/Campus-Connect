package com.campusconnect.team;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** One entry of a project's activity feed; source is e.g. GITHUB or SYSTEM. */
@Entity
@Table(name = "project_activity")
public class ProjectActivity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;
    private String source;
    private String summary;
    private String url;
    private Instant createdAt = Instant.now();

    protected ProjectActivity() {
    }

    public ProjectActivity(Long projectId, String source, String summary, String url) {
        this.projectId = projectId;
        this.source = source;
        this.summary = summary;
        this.url = url;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public String getSource() { return source; }
    public String getSummary() { return summary; }
    public String getUrl() { return url; }
    public Instant getCreatedAt() { return createdAt; }
}
