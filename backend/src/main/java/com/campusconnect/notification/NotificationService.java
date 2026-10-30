package com.campusconnect.notification;

import com.campusconnect.common.AfterCommit;
import com.campusconnect.common.Errors;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores in-app notifications and pushes them live to the user's /user/queue/notifications. */
@Service
public class NotificationService {

    public record NotificationView(long id, String type, String message, String link, boolean read,
                                   Instant createdAt) {
        static NotificationView of(Notification n) {
            return new NotificationView(n.getId(), n.getType(), n.getMessage(), n.getLink(), n.isRead(),
                n.getCreatedAt());
        }
    }

    private final NotificationRepository notifications;
    private final SimpMessagingTemplate messaging;

    public NotificationService(NotificationRepository notifications, SimpMessagingTemplate messaging) {
        this.notifications = notifications;
        this.messaging = messaging;
    }

    @Transactional
    public void notify(long userId, String type, String message, String link) {
        NotificationView view = NotificationView.of(notifications.save(new Notification(userId, type, message, link)));
        AfterCommit.runAsync(() ->
            messaging.convertAndSendToUser(Long.toString(userId), "/queue/notifications", view));
    }

    @Transactional(readOnly = true)
    public List<NotificationView> recent(long userId) {
        return notifications.findByUserIdOrderByCreatedAtDesc(userId, Limit.of(50)).stream()
            .map(NotificationView::of).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(long userId) {
        return notifications.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public void markRead(long id, long userId) {
        Notification n = notifications.findById(id)
            .filter(x -> x.getUserId() == userId)
            .orElseThrow(() -> Errors.notFound("Notification"));
        n.markRead();
    }

    @Transactional
    public void markAllRead(long userId) {
        notifications.markAllRead(userId);
    }
}
