package com.campusconnect.automation;

import com.campusconnect.common.Errors;
import com.campusconnect.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Machine API for n8n workflows (scheduled digests, reminders). Authenticated with the
 * X-Api-Key header, which must equal AUTOMATION_API_KEY.
 */
@RestController
@RequestMapping("/api/automation")
public class AutomationController {

    public record DigestEntry(long userId, String email, String fullName, long unreadNotifications,
                              long pendingInvites, long openTasks, List<String> newProjectsForYou) {
    }

    public record StaleApplication(long applicationId, long projectId, String projectTitle, String ownerEmail,
                                   String ownerName, String applicantName, long daysPending) {
    }

    public record PushNotification(@NotNull Long userId, @NotBlank @Size(max = 40) String type,
                                   @NotBlank @Size(max = 500) String message, @Size(max = 255) String link) {
    }

    private final String apiKey;
    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    public AutomationController(@Value("${app.automation.api-key}") String apiKey, JdbcTemplate jdbc,
                                NotificationService notifications) {
        this.apiKey = apiKey;
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    /** Students with something to catch up on, plus new open projects matching their skills (last 7 days). */
    @GetMapping("/weekly-digest")
    List<DigestEntry> weeklyDigest(@RequestHeader(value = "X-Api-Key", required = false) String key) {
        check(key);
        return jdbc.query("""
            select u.id, u.email, u.full_name,
              (select count(*) from notifications n where n.user_id = u.id and not n.is_read) as unread,
              (select count(*) from applications a where a.user_id = u.id and a.kind = 'INVITE'
                 and a.status = 'PENDING') as invites,
              (select count(*) from tasks t where t.assignee_id = u.id and t.status <> 'DONE') as tasks,
              array(select distinct p.title from projects p
                    join project_skills ps on ps.project_id = p.id
                    join user_skills us on us.skill = ps.skill and us.user_id = u.id
                    where p.status = 'OPEN' and p.owner_id <> u.id
                      and p.created_at > now() - interval '7 days'
                    limit 5) as projects
            from users u
            """, (rs, i) -> new DigestEntry(rs.getLong("id"), rs.getString("email"), rs.getString("full_name"),
                rs.getLong("unread"), rs.getLong("invites"), rs.getLong("tasks"),
                List.of((String[]) rs.getArray("projects").getArray())))
            .stream()
            .filter(d -> d.unreadNotifications() + d.pendingInvites() + d.openTasks() > 0
                || !d.newProjectsForYou().isEmpty())
            .toList();
    }

    /** Applications nobody has answered for a while, so n8n can nudge the project owner. */
    @GetMapping("/stale-applications")
    List<StaleApplication> staleApplications(@RequestHeader(value = "X-Api-Key", required = false) String key,
                                             @RequestParam(defaultValue = "3") int days) {
        check(key);
        return jdbc.query("""
            select a.id, p.id as project_id, p.title, o.email, o.full_name as owner_name,
                   s.full_name as applicant_name, extract(day from now() - a.created_at)::bigint as days
            from applications a
            join projects p on p.id = a.project_id
            join users o on o.id = p.owner_id
            join users s on s.id = a.user_id
            where a.kind = 'APPLY' and a.status = 'PENDING' and a.created_at < now() - make_interval(days => ?)
            order by a.created_at
            """, (rs, i) -> new StaleApplication(rs.getLong("id"), rs.getLong("project_id"), rs.getString("title"),
            rs.getString("email"), rs.getString("owner_name"), rs.getString("applicant_name"), rs.getLong("days")),
            Math.max(1, days));
    }

    /** Lets a workflow drop an in-app notification (e.g. "your weekly digest was emailed"). */
    @PostMapping("/notifications")
    @ResponseStatus(HttpStatus.CREATED)
    void push(@RequestHeader(value = "X-Api-Key", required = false) String key,
              @Valid @RequestBody PushNotification req) {
        check(key);
        notifications.notify(req.userId(), req.type(), req.message(), req.link());
    }

    private void check(String key) {
        if (apiKey == null || apiKey.isBlank()) {
            throw Errors.unavailable("Automation API is not configured");
        }
        if (key == null || !MessageDigest.isEqual(apiKey.getBytes(StandardCharsets.UTF_8),
                key.getBytes(StandardCharsets.UTF_8))) {
            throw Errors.unauthorized("Invalid API key");
        }
    }
}
