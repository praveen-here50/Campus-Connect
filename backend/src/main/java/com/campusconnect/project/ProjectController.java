package com.campusconnect.project;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.project.ProjectDtos.ApplicationView;
import com.campusconnect.project.ProjectDtos.ApplyRequest;
import com.campusconnect.project.ProjectDtos.InviteRequest;
import com.campusconnect.project.ProjectDtos.ProjectDetail;
import com.campusconnect.project.ProjectDtos.ProjectSummary;
import com.campusconnect.project.ProjectDtos.SaveProject;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService service;
    private final TaskService tasks;

    public ProjectController(ProjectService service, TaskService tasks) {
        this.service = service;
        this.tasks = tasks;
    }

    @GetMapping
    List<ProjectSummary> search(@AuthenticationPrincipal Jwt jwt,
                                @RequestParam(required = false) String q,
                                @RequestParam(required = false) String skill,
                                @RequestParam(required = false) String category,
                                @RequestParam(required = false) String status) {
        return service.search(q, skill, category, status, CurrentUser.id(jwt));
    }

    @GetMapping("/by-user/{userId}")
    List<ProjectSummary> byUser(@PathVariable long userId) {
        return service.mine(userId);
    }

    @GetMapping("/mine")
    List<ProjectSummary> mine(@AuthenticationPrincipal Jwt jwt) {
        return service.mine(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ProjectDetail create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SaveProject req) {
        return service.create(CurrentUser.id(jwt), req);
    }

    @GetMapping("/{id}")
    ProjectDetail get(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.detail(id, CurrentUser.id(jwt));
    }

    @PutMapping("/{id}")
    ProjectDetail update(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                         @Valid @RequestBody SaveProject req) {
        return service.update(id, CurrentUser.id(jwt), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        service.delete(id, CurrentUser.id(jwt));
    }

    @DeleteMapping("/{id}/members/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void removeMember(@AuthenticationPrincipal Jwt jwt, @PathVariable long id, @PathVariable long userId) {
        service.removeMember(id, CurrentUser.id(jwt), userId);
    }

    @PostMapping("/{id}/applications")
    @ResponseStatus(HttpStatus.CREATED)
    ApplicationView apply(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                          @Valid @RequestBody ApplyRequest req) {
        return service.applyTo(id, CurrentUser.id(jwt), req);
    }

    @GetMapping("/{id}/applications")
    List<ApplicationView> applications(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return service.forProject(id, CurrentUser.id(jwt));
    }

    @PostMapping("/{id}/invites")
    @ResponseStatus(HttpStatus.CREATED)
    ApplicationView invite(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                           @Valid @RequestBody InviteRequest req) {
        return service.invite(id, CurrentUser.id(jwt), req);
    }

    @GetMapping("/{id}/tasks")
    List<TaskView> tasks(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return tasks.list(id, CurrentUser.id(jwt));
    }

    @PostMapping("/{id}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    TaskView createTask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                        @Valid @RequestBody SaveTask req) {
        return tasks.create(id, CurrentUser.id(jwt), req);
    }
}
