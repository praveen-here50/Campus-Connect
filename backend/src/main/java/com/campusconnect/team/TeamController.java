package com.campusconnect.team;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.team.ActivityService.ActivityView;
import com.campusconnect.team.TeamService.MessageView;
import java.security.Principal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Chat is sent over STOMP (/app/projects/{id}/chat) and broadcast on /topic/projects/{id}/chat;
 * the REST endpoints serve history and a fallback for clients without a socket.
 */
@Controller
public class TeamController {

    public record SendMessage(String content) {
    }

    private final TeamService service;

    public TeamController(TeamService service) {
        this.service = service;
    }

    @MessageMapping("/projects/{id}/chat")
    void chat(@DestinationVariable long id, @Payload SendMessage msg, Principal principal) {
        service.send(id, Long.parseLong(principal.getName()), msg.content());
    }

    @GetMapping("/api/projects/{id}/messages")
    @ResponseBody
    List<MessageView> history(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.history(id, CurrentUser.id(jwt));
    }

    @PostMapping("/api/projects/{id}/messages")
    @ResponseBody
    @ResponseStatus(HttpStatus.CREATED)
    MessageView send(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @RequestBody SendMessage msg) {
        return service.send(id, CurrentUser.id(jwt), msg.content());
    }

    @GetMapping("/api/projects/{id}/activity")
    @ResponseBody
    List<ActivityView> activity(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.activity(id, CurrentUser.id(jwt));
    }
}
