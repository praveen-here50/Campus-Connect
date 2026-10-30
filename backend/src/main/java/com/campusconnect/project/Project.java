package com.campusconnect.project;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "projects")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long ownerId;
    private String title;
    private String description;
    private String category;
    private String status = "OPEN";
    private Short maxMembers = 4;
    private String githubRepo;
    private Instant createdAt = Instant.now();

    /** required skill names, lower-case */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "project_skills", joinColumns = @JoinColumn(name = "project_id"))
    @Column(name = "skill")
    private Set<String> skills = new HashSet<>();

    protected Project() {
    }

    public Project(Long ownerId) {
        this.ownerId = ownerId;
    }

    public Long getId() { return id; }
    public Long getOwnerId() { return ownerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Short getMaxMembers() { return maxMembers; }
    public void setMaxMembers(Short maxMembers) { this.maxMembers = maxMembers; }
    public String getGithubRepo() { return githubRepo; }
    public void setGithubRepo(String githubRepo) { this.githubRepo = githubRepo; }
    public Instant getCreatedAt() { return createdAt; }
    public Set<String> getSkills() { return skills; }
}
