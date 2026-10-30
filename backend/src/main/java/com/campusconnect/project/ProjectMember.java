package com.campusconnect.project;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "project_members")
@IdClass(ProjectMember.Key.class)
public class ProjectMember {

    public static final String OWNER = "OWNER";
    public static final String MEMBER = "MEMBER";

    @Id
    private Long projectId;

    @Id
    private Long userId;

    private String role;
    private Instant joinedAt = Instant.now();

    protected ProjectMember() {
    }

    public ProjectMember(Long projectId, Long userId, String role) {
        this.projectId = projectId;
        this.userId = userId;
        this.role = role;
    }

    public Long getProjectId() { return projectId; }
    public Long getUserId() { return userId; }
    public String getRole() { return role; }
    public Instant getJoinedAt() { return joinedAt; }

    public static class Key implements Serializable {

        private Long projectId;
        private Long userId;

        protected Key() {
        }

        public Key(Long projectId, Long userId) {
            this.projectId = projectId;
            this.userId = userId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(projectId, k.projectId) && Objects.equals(userId, k.userId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(projectId, userId);
        }
    }
}
