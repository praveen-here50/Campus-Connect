package com.campusconnect.ai;

import com.campusconnect.common.Errors;
import com.campusconnect.project.Project;
import com.campusconnect.project.ProjectDtos.ProjectSummary;
import com.campusconnect.project.ProjectRepository;
import com.campusconnect.project.ProjectService;
import com.campusconnect.user.User;
import com.campusconnect.user.UserDtos.UserSummary;
import com.campusconnect.user.UserRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hybrid matching: cosine similarity of pgvector embeddings (meaning of profile and project text)
 * blended with exact skill overlap. Works with skills alone when embeddings are not available.
 */
@Service
public class MatchService {

    public record ProjectMatch(ProjectSummary project, int score, List<String> matchedSkills,
                               List<String> missingSkills) {
    }

    public record UserMatch(UserSummary user, int score, List<String> matchedSkills) {
    }

    private final JdbcTemplate jdbc;
    private final ProjectRepository projects;
    private final ProjectService projectService;
    private final UserRepository users;

    public MatchService(JdbcTemplate jdbc, ProjectRepository projects, ProjectService projectService,
                        UserRepository users) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.projectService = projectService;
        this.users = users;
    }

    /** Open projects with free seats that fit the student, best first; a project with no fit at all is left out. */
    @Transactional(readOnly = true)
    public List<ProjectMatch> projectsFor(long userId, int limit) {
        User me = users.findById(userId).orElseThrow(() -> Errors.notFound("User"));
        Map<Long, Double> similarity = new HashMap<>();
        jdbc.query("""
            select p.id, case when p.embedding is not null and u.embedding is not null
                              then 1 - (p.embedding <=> u.embedding) end as sim
            from projects p cross join users u
            where u.id = ? and p.status = 'OPEN'
              and not exists (select 1 from project_members m where m.project_id = p.id and m.user_id = u.id)
              and (select count(*) from project_members m where m.project_id = p.id) < p.max_members
            """, rs -> {
            double sim = rs.getDouble("sim");
            similarity.put(rs.getLong("id"), rs.wasNull() ? null : sim);
        }, userId);
        Set<String> mySkills = me.getSkills().keySet();
        List<Scored<Project>> scored = new ArrayList<>();
        for (Project p : projects.findAllById(similarity.keySet())) {
            scored.add(new Scored<>(p, score(similarity.get(p.getId()), mySkills, p.getSkills())));
        }
        List<Scored<Project>> top = scored.stream()
            .filter(s -> percent(s.score) > 0)
            .sorted(Comparator.comparingDouble((Scored<Project> s) -> s.score).reversed()
                .thenComparing(s -> s.item.getCreatedAt(), Comparator.reverseOrder()))
            .limit(limit).toList();
        Map<Long, ProjectSummary> summaries = projectService.summariesOf(top.stream().map(s -> s.item).toList())
            .stream().collect(Collectors.toMap(ProjectSummary::id, Function.identity()));
        return top.stream().map(s -> new ProjectMatch(summaries.get(s.item.getId()), percent(s.score),
            s.item.getSkills().stream().filter(mySkills::contains).sorted().toList(),
            s.item.getSkills().stream().filter(k -> !mySkills.contains(k)).sorted().toList())).toList();
    }

    /** Students (not yet on the team, not busy) who fit a project; members and the owner may ask. */
    @Transactional(readOnly = true)
    public List<UserMatch> teammatesFor(long projectId, long callerId, int limit) {
        projectService.requireMember(projectId, callerId);
        Project p = projectService.find(projectId);
        Map<Long, Double> similarity = new HashMap<>();
        jdbc.query("""
            select u.id, case when p.embedding is not null and u.embedding is not null
                              then 1 - (u.embedding <=> p.embedding) end as sim
            from users u cross join projects p
            where p.id = ? and u.availability <> 'BUSY'
              and not exists (select 1 from project_members m where m.project_id = p.id and m.user_id = u.id)
            order by sim desc nulls last
            limit 300
            """, rs -> {
            double sim = rs.getDouble("sim");
            similarity.put(rs.getLong("id"), rs.wasNull() ? null : sim);
        }, projectId);
        return users.findAllById(similarity.keySet()).stream()
            .map(u -> new Scored<>(u, score(similarity.get(u.getId()), u.getSkills().keySet(), p.getSkills())))
            .filter(s -> percent(s.score) > 0)
            .sorted(Comparator.comparingDouble((Scored<User> s) -> s.score).reversed())
            .limit(limit)
            .map(s -> new UserMatch(UserSummary.of(s.item), percent(s.score),
                p.getSkills().stream().filter(s.item.getSkills()::containsKey).sorted().toList()))
            .toList();
    }

    /** 60% meaning, 40% share of the project's required skills that are covered. */
    private static double score(Double similarity, Set<String> have, Set<String> needed) {
        double skillScore = needed.isEmpty() ? 0 : needed.stream().filter(have::contains).count() / (double) needed.size();
        return similarity == null ? skillScore : 0.6 * Math.max(0, similarity) + 0.4 * skillScore;
    }

    private static int percent(double score) {
        return (int) Math.round(Math.min(1, score) * 100);
    }

    private record Scored<T>(T item, double score) {
    }
}
