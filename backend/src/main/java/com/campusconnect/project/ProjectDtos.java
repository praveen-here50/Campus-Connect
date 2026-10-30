package com.campusconnect.project;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Set;

public final class ProjectDtos {

    private ProjectDtos() {
    }

    public record ProjectSummary(long id, String title, String category, String status, short maxMembers,
                                 long memberCount, Set<String> skills, long ownerId, String ownerName,
                                 Instant createdAt) {
    }

    public record MemberView(long userId, String fullName, String headline, String role, Instant joinedAt) {
    }

    /** myRole is OWNER, MEMBER or null; myRequest is the caller's pending application/invite, if any. */
    public record ProjectDetail(long id, String title, String description, String category, String status,
                                short maxMembers, String githubRepo, long ownerId, Set<String> skills,
                                List<MemberView> members, Instant createdAt, String myRole,
                                ApplicationView myRequest) {
    }

    public record SaveProject(
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 5000) String description,
        @NotBlank @Size(max = 60) String category,
        @Pattern(regexp = "OPEN|IN_PROGRESS|COMPLETED") String status,
        @Min(2) @Max(20) Short maxMembers,
        @Size(max = 255) String githubRepo,
        @Size(max = 20) Set<@NotBlank @Size(max = 60) String> skills) {
    }

    public record ApplyRequest(@Size(max = 1000) String message) {
    }

    public record InviteRequest(@NotNull Long userId, @Size(max = 1000) String message) {
    }

    public record ApplicationView(long id, long projectId, String projectTitle, long userId, String userName,
                                  String kind, String message, String status, Instant createdAt) {
    }

    public record TaskView(long id, String title, String status, Long assigneeId, String assigneeName,
                           Instant createdAt) {
    }

    public record SaveTask(
        @NotBlank @Size(max = 200) String title,
        @Pattern(regexp = "TODO|IN_PROGRESS|DONE") String status,
        Long assigneeId) {
    }
}
