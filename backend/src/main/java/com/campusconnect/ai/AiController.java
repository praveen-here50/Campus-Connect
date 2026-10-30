package com.campusconnect.ai;

import com.campusconnect.ai.AssistantService.Answer;
import com.campusconnect.ai.AssistantService.ProjectDraft;
import com.campusconnect.ai.AssistantService.ResumeSuggestion;
import com.campusconnect.ai.AssistantService.TaskSuggestions;
import com.campusconnect.ai.AssistantService.Turn;
import com.campusconnect.ai.MatchService.ProjectMatch;
import com.campusconnect.ai.MatchService.UserMatch;
import com.campusconnect.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    public record AskRequest(@NotBlank @Size(max = 2000) String question, @Size(max = 20) List<Turn> history) {
    }

    public record IdeaRequest(@NotBlank @Size(max = 2000) String idea) {
    }

    private final AiClient ai;
    private final MatchService matches;
    private final AssistantService assistant;

    public AiController(AiClient ai, MatchService matches, AssistantService assistant) {
        this.ai = ai;
        this.matches = matches;
        this.assistant = assistant;
    }

    /** Lets the UI hide AI buttons when the server has no key. */
    @GetMapping("/status")
    Map<String, Boolean> status() {
        return Map.of("enabled", ai.enabled());
    }

    @GetMapping("/recommendations/projects")
    List<ProjectMatch> recommendedProjects(@AuthenticationPrincipal Jwt jwt,
                                           @RequestParam(defaultValue = "10") int limit) {
        return matches.projectsFor(CurrentUser.id(jwt), Math.clamp(limit, 1, 30));
    }

    @GetMapping("/recommendations/projects/{id}/teammates")
    List<UserMatch> recommendedTeammates(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
                                         @RequestParam(defaultValue = "10") int limit) {
        return matches.teammatesFor(id, CurrentUser.id(jwt), Math.clamp(limit, 1, 30));
    }

    @PostMapping("/assistant")
    Answer ask(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AskRequest req) {
        return assistant.ask(CurrentUser.id(jwt), req.question(), req.history());
    }

    @PostMapping("/resume")
    ResumeSuggestion resume(@RequestPart("file") MultipartFile file) {
        return assistant.parseResume(file);
    }

    @PostMapping("/project-draft")
    ProjectDraft draft(@Valid @RequestBody IdeaRequest req) {
        return assistant.draftProject(req.idea());
    }

    @PostMapping("/projects/{id}/task-suggestions")
    TaskSuggestions suggestTasks(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
        return assistant.suggestTasks(id, CurrentUser.id(jwt));
    }
}
