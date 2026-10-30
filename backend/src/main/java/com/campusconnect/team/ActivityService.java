package com.campusconnect.team;

import com.campusconnect.common.AfterCommit;
import java.time.Instant;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Writes a project's activity feed and pushes each entry live to /topic/projects/{id}/activity. */
@Service
public class ActivityService {

    public record ActivityView(long id, long projectId, String source, String summary, String url,
                               Instant createdAt) {
        static ActivityView of(ProjectActivity a) {
            return new ActivityView(a.getId(), a.getProjectId(), a.getSource(), a.getSummary(), a.getUrl(),
                a.getCreatedAt());
        }
    }

    private final ProjectActivityRepository activity;
    private final SimpMessagingTemplate messaging;

    public ActivityService(ProjectActivityRepository activity, SimpMessagingTemplate messaging) {
        this.activity = activity;
        this.messaging = messaging;
    }

    @Transactional
    public void record(long projectId, String source, String summary, String url) {
        ActivityView view = ActivityView.of(activity.save(new ProjectActivity(projectId, source, summary, url)));
        AfterCommit.runAsync(() -> messaging.convertAndSend("/topic/projects/" + projectId + "/activity", view));
    }
}
