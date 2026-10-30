package com.campusconnect.dashboard;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.dashboard.DashboardService.Dashboard;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/api/dashboard")
    Dashboard dashboard(@AuthenticationPrincipal Jwt jwt) {
        return service.forUser(CurrentUser.id(jwt));
    }
}
