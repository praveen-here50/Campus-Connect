package com.campusconnect.project;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.project.ProjectDtos.ApplicationView;
import com.campusconnect.project.ProjectDtos.SaveTask;
import com.campusconnect.project.ProjectDtos.TaskView;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints addressed by application or task id rather than through their project. */
@RestController
@RequestMapping("/api")
public class ApplicationController {

    private final ProjectService projects;
    private final TaskService tasks;

    public ApplicationController(ProjectService projects, TaskService tasks) {
        this.projects = projects;
        this.tasks = tasks;
    }

    @GetMapping("/applications/mine")
    List<ApplicationView> mine(@AuthenticationPrincipal Jwt jwt) {
        return projects.forUser(CurrentUser.id(jwt));
    }

    @GetMapping("/applications/incoming")
    List<ApplicationView> incoming(@AuthenticationPrincipal Jwt jwt) {
        return projects.incoming(CurrentUser.id(jwt));
    }

    @PostMapping("/applications/{id}/accept")
    ApplicationView accept(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return projects.decide(id, CurrentUser.id(jwt), true);
    }

    @PostMapping("/applications/{id}/reject")
    ApplicationView reject(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return projects.decide(id, CurrentUser.id(jwt), false);
    }

    @DeleteMapping("/applications/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void withdraw(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        projects.withdraw(id, CurrentUser.id(jwt));
    }

    @PutMapping("/tasks/{id}")
    TaskView updateTask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @Valid @RequestBody SaveTask req) {
        return tasks.update(id, CurrentUser.id(jwt), req);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteTask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        tasks.delete(id, CurrentUser.id(jwt));
    }
}
