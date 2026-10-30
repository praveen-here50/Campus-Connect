package com.campusconnect.ai;

import com.campusconnect.common.Errors;
import com.campusconnect.project.Project;
import com.campusconnect.project.ProjectService;
import com.campusconnect.project.TaskRepository;
import com.campusconnect.user.User;
import com.campusconnect.user.UserRepository;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** LLM-backed helpers: campus assistant (RAG over the knowledge hub), résumé import, project drafting. */
@Service
public class AssistantService {

    public record Turn(String role, String content) {
    }

    public record Source(String kind, long id, String title) {
    }

    public record Answer(String answer, List<Source> sources) {
    }

    public record SkillLevel(String name, int level) {
    }

    public record ResumeSuggestion(String headline, String bio, String department, List<SkillLevel> skills) {
    }

    public record ProjectDraft(String title, String description, String category, List<String> skills,
                               List<String> tasks) {
    }

    public record TaskSuggestions(List<String> tasks) {
    }

    private static final int MAX_RESUME_CHARS = 12_000;

    private final AiClient ai;
    private final EmbeddingService embeddings;
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final ProjectService projects;
    private final TaskRepository tasks;
    private final MatchService matches;

    public AssistantService(AiClient ai, EmbeddingService embeddings, JdbcTemplate jdbc, UserRepository users,
                            ProjectService projects, TaskRepository tasks, MatchService matches) {
        this.ai = ai;
        this.embeddings = embeddings;
        this.jdbc = jdbc;
        this.users = users;
        this.projects = projects;
        this.tasks = tasks;
        this.matches = matches;
    }

    /** Answers using the most relevant knowledge-hub posts and open projects as context. */
    public Answer ask(long userId, String question, List<Turn> history) {
        if (!ai.enabled()) {
            throw Errors.unavailable("AI features are not configured on this server");
        }
        User me = users.findById(userId).orElseThrow(() -> Errors.notFound("User"));
        List<Long> postIds = safeNearest("posts", question, "not flagged", 4);
        List<Long> projectIds = safeNearest("projects", question, "status = 'OPEN'", 3);
        StringBuilder context = new StringBuilder();
        List<Source> sources = new ArrayList<>();
        for (Map<String, Object> row : rows("select id, title, left(body, 1500) as text from posts where id = any(?)", postIds)) {
            context.append("[Post #").append(row.get("id")).append("] ").append(row.get("title")).append('\n')
                .append(row.get("text")).append("\n\n");
            sources.add(new Source("POST", ((Number) row.get("id")).longValue(), (String) row.get("title")));
        }
        for (Map<String, Object> row : rows("select id, title, left(description, 600) as text from projects where id = any(?)", projectIds)) {
            context.append("[Project #").append(row.get("id")).append("] ").append(row.get("title")).append('\n')
                .append(row.get("text")).append("\n\n");
            sources.add(new Source("PROJECT", ((Number) row.get("id")).longValue(), (String) row.get("title")));
        }
        // The same ranking as "Projects that fit you", so "which project suits my skills?" gets real numbers.
        StringBuilder fits = new StringBuilder();
        for (MatchService.ProjectMatch m : matches.projectsFor(userId, 5)) {
            fits.append("[Project #").append(m.project().id()).append("] ").append(m.project().title())
                .append(": ").append(m.score()).append("% match; student has ")
                .append(m.matchedSkills().isEmpty() ? "none of its skills" : String.join(", ", m.matchedSkills()))
                .append("; missing ").append(m.missingSkills().isEmpty() ? "nothing" : String.join(", ", m.missingSkills()))
                .append('\n');
            if (sources.stream().noneMatch(src -> "PROJECT".equals(src.kind()) && src.id() == m.project().id())) {
                sources.add(new Source("PROJECT", m.project().id(), m.project().title()));
            }
        }
        String skills = me.getSkills().entrySet().stream()
            .sorted(Map.Entry.<String, Short>comparingByValue().reversed())
            .map(e -> e.getKey() + " (" + e.getValue() + "/5)")
            .collect(Collectors.joining(", "));
        String transcript = history == null ? "" : history.stream()
            .skip(Math.max(0, history.size() - 6))
            .map(t -> ("assistant".equals(t.role()) ? "Assistant: " : "Student: ") + t.content())
            .collect(Collectors.joining("\n"));
        String system = """
            You are the CampusConnect assistant for university students. Help with studying, programming,
            finding teammates and projects on CampusConnect, and planning project work. Be concise and practical,
            use Markdown. When you use the context below, cite it as [Post #id] or [Project #id]. If the context
            does not help, answer from general knowledge and say so. Never invent CampusConnect posts or projects.

            The student: %s, %s. Skills with self-rated level: %s.

            Open projects that fit this student best (CampusConnect's skill and profile match, best first):
            %s
            Context from CampusConnect:
            %s
            """.formatted(me.getFullName(), me.getDepartment() == null ? "department unknown" : me.getDepartment(),
            skills.isEmpty() ? "none listed yet" : skills,
            fits.isEmpty() ? "(no open projects with a free seat)\n" : fits.toString(),
            context.isEmpty() ? "(nothing relevant found)" : context);
        String user = (transcript.isEmpty() ? "" : "Conversation so far:\n" + transcript + "\n\n")
            + "Student: " + question;
        String answer = ai.text(system, user);
        // Only what the answer cites in the asked-for form: "[Project #2]" must not also count as Post #2.
        List<Source> cited = sources.stream()
            .filter(s -> answer.contains(("POST".equals(s.kind()) ? "[Post #" : "[Project #") + s.id() + "]"))
            .toList();
        return new Answer(answer, cited);
    }

    /** Extracts profile suggestions from a PDF résumé; nothing is saved until the student confirms. */
    public ResumeSuggestion parseResume(MultipartFile file) {
        if (file.isEmpty() || !"application/pdf".equals(file.getContentType())) {
            throw Errors.badRequest("Please upload your résumé as a PDF");
        }
        String text;
        try (PDDocument doc = Loader.loadPDF(file.getBytes())) {
            text = new PDFTextStripper().getText(doc).strip();
        } catch (IOException e) {
            throw Errors.badRequest("Could not read this PDF");
        }
        if (text.isBlank()) {
            throw Errors.badRequest("This PDF has no selectable text (is it a scanned image?)");
        }
        if (text.length() > MAX_RESUME_CHARS) {
            text = text.substring(0, MAX_RESUME_CHARS);
        }
        return ai.entity("""
            Extract a student profile from the résumé text. headline: at most 12 words (e.g. "CS junior |
            Backend & ML enthusiast"). bio: 2-3 sentences, first person. department: field of study or null.
            skills: up to 15 concrete technical or professional skills, lower-case short names (e.g. "react",
            "python", "figma"), with level 1-5 estimated from evidence (projects, years, roles). Do not invent anything.
            """, text, ResumeSuggestion.class);
    }

    /** Turns a rough idea into a project listing the student can edit before publishing. */
    public ProjectDraft draftProject(String idea) {
        return ai.entity("""
            Turn a student's rough idea into a project listing for finding teammates on a campus platform.
            title: catchy, at most 8 words. description: 80-150 words covering goal, scope and what teammates
            will learn. category: one of Web, Mobile, AI/ML, Data, Hardware/IoT, Game, Research, Design, Other.
            skills: 3-8 lower-case skill names needed. tasks: 5-8 concrete first tasks, each under 12 words.
            """, idea, ProjectDraft.class);
    }

    /** Suggests next tasks for a project based on its description and existing board. */
    public TaskSuggestions suggestTasks(long projectId, long userId) {
        projects.requireMember(projectId, userId);
        Project p = projects.find(projectId);
        String existing = tasks.findByProjectIdOrderByCreatedAt(projectId).stream()
            .map(t -> "- [" + t.getStatus() + "] " + t.getTitle()).collect(Collectors.joining("\n"));
        return ai.entity("""
            You are a helpful project manager for a student team. Suggest 5 concrete next tasks that are not
            already on the board, each under 12 words, ordered by priority.
            """, "Project: " + p.getTitle() + "\n" + p.getDescription() + "\nSkills: " + String.join(", ", p.getSkills())
            + "\n\nCurrent board:\n" + (existing.isEmpty() ? "(empty)" : existing), TaskSuggestions.class);
    }

    private List<Long> safeNearest(String table, String text, String where, int limit) {
        try {
            return embeddings.nearest(table, text, where, limit);
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<Map<String, Object>> rows(String sql, List<Long> ids) {
        return ids.isEmpty() ? List.of() : jdbc.queryForList(sql, (Object) ids.toArray(new Long[0]));
    }
}
