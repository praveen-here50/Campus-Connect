package com.campusconnect.notification;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.notification.NotificationService.NotificationView;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    List<NotificationView> recent(@AuthenticationPrincipal Jwt jwt) {
        return service.recent(CurrentUser.id(jwt));
    }

    @GetMapping("/unread-count")
    Map<String, Long> unread(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("count", service.unreadCount(CurrentUser.id(jwt)));
    }

    @PostMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void read(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        service.markRead(id, CurrentUser.id(jwt));
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void readAll(@AuthenticationPrincipal Jwt jwt) {
        service.markAllRead(CurrentUser.id(jwt));
    }
}
