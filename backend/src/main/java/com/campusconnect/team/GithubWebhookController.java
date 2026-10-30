package com.campusconnect.team;

import com.campusconnect.common.Errors;
import com.campusconnect.notification.NotificationService;
import com.campusconnect.project.Project;
import com.campusconnect.project.ProjectMemberRepository;
import com.campusconnect.project.ProjectMember;
import com.campusconnect.project.ProjectRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Receives GitHub webhooks (push, pull_request) for repositories linked to a project and turns them
 * into activity-feed entries. Payloads are verified with the shared GITHUB_WEBHOOK_SECRET.
 */
@RestController
public class GithubWebhookController {

    private final String secret;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final ActivityService activity;
    private final NotificationService notifications;
    private final JsonMapper json;

    public GithubWebhookController(@Value("${app.github.webhook-secret}") String secret, ProjectRepository projects,
                                   ProjectMemberRepository members, ActivityService activity,
                                   NotificationService notifications, JsonMapper json) {
        this.secret = secret;
        this.projects = projects;
        this.members = members;
        this.activity = activity;
        this.notifications = notifications;
        this.json = json;
    }

    @PostMapping("/api/integrations/github")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Transactional
    public void receive(@RequestHeader(value = "X-GitHub-Event", defaultValue = "") String event,
                        @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
                        @RequestBody byte[] body) {
        if (secret == null || secret.isBlank()) {
            throw Errors.unavailable("GitHub integration is not configured");
        }
        if (signature == null || !MessageDigest.isEqual(sign(body).getBytes(StandardCharsets.UTF_8),
                signature.getBytes(StandardCharsets.UTF_8))) {
            throw Errors.unauthorized("Invalid signature");
        }
        JsonNode payload = json.readTree(body);
        String repo = normalizeRepo(payload.path("repository").path("full_name").asString(""));
        List<Project> linked = projects.findByGithubRepoIsNotNull().stream()
            .filter(p -> normalizeRepo(p.getGithubRepo()).equals(repo)).toList();
        if (linked.isEmpty()) {
            return;
        }
        String summary;
        String url;
        switch (event) {
            case "push" -> {
                int commits = payload.path("commits").size();
                if (commits == 0) {
                    return;
                }
                String branch = payload.path("ref").asString("").replace("refs/heads/", "");
                String first = payload.path("head_commit").path("message").asString("").lines().findFirst()
                    .orElse("");
                summary = payload.path("pusher").path("name").asString("Someone") + " pushed " + commits
                    + (commits == 1 ? " commit" : " commits") + " to " + branch + ": " + first;
                url = payload.path("compare").asString(null);
            }
            case "pull_request" -> {
                String action = payload.path("action").asString("");
                JsonNode pr = payload.path("pull_request");
                if (!List.of("opened", "closed", "reopened").contains(action)) {
                    return;
                }
                if ("closed".equals(action) && pr.path("merged").asBoolean(false)) {
                    action = "merged";
                }
                summary = pr.path("user").path("login").asString("Someone") + " " + action + " pull request #"
                    + pr.path("number").asInt() + ": " + pr.path("title").asString("");
                url = pr.path("html_url").asString(null);
            }
            default -> {
                return;
            }
        }
        String text = summary.length() > 500 ? summary.substring(0, 497) + "..." : summary;
        for (Project p : linked) {
            activity.record(p.getId(), "GITHUB", text, url);
            for (ProjectMember m : members.findByProjectIdOrderByJoinedAt(p.getId())) {
                notifications.notify(m.getUserId(), "GITHUB", p.getTitle() + ": " + text,
                    "/projects/" + p.getId() + "/workspace");
            }
        }
    }

    /** Accepts "owner/repo", "https://github.com/owner/repo(.git)" etc. */
    static String normalizeRepo(String repo) {
        String r = repo.trim().toLowerCase(Locale.ROOT);
        r = r.replaceFirst("^(https?://)?(www\\.)?github\\.com/", "");
        r = r.replaceFirst("\\.git$", "");
        return r.replaceAll("/+$", "");
    }

    private String sign(byte[] body) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return "sha256=" + HexFormat.of().formatHex(mac.doFinal(body));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
