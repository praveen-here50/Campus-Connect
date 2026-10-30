package com.campusconnect.user;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.user.ConnectionService.ConnectionView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/connections")
public class ConnectionController {

    public record ConnectRequest(@NotNull Long userId) {
    }

    private final ConnectionService service;

    public ConnectionController(ConnectionService service) {
        this.service = service;
    }

    @GetMapping
    List<ConnectionView> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ConnectionView request(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ConnectRequest req) {
        return service.request(CurrentUser.id(jwt), req.userId());
    }

    @PostMapping("/{id}/accept")
    ConnectionView accept(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.accept(id, CurrentUser.id(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        service.remove(id, CurrentUser.id(jwt));
    }
}
