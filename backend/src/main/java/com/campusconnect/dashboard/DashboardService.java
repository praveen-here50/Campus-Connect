package com.campusconnect.dashboard;

import com.campusconnect.ai.MatchService;
import com.campusconnect.ai.MatchService.ProjectMatch;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** One call that feeds the student's home dashboard. */
@Service
public class DashboardService {

    public record Stats(long projects, long ownedProjects, long openTasks, long pendingRequests,
                        long unreadNotifications, long connections, long posts, long upvotesReceived) {
    }

    public record Count(String label, long count) {
    }

    public record TaskItem(long id, String title, String status, long projectId, String projectTitle) {
    }

    public record ActivityItem(long id, long projectId, String projectTitle, String source, String summary,
                               String url, Instant createdAt) {
    }

    public record Platform(long students, long openProjects, long posts) {
    }

    public record Dashboard(Stats stats, List<Count> tasksByStatus, List<TaskItem> myTasks,
                            List<ActivityItem> recentActivity, List<ProjectMatch> recommended,
                            Platform platform, List<Count> topSkills, List<Count> categories) {
    }

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final MatchService matches;

    public DashboardService(JdbcTemplate jdbc, NamedParameterJdbcTemplate named, MatchService matches) {
        this.jdbc = jdbc;
        this.named = named;
        this.matches = matches;
    }

    @Transactional(readOnly = true)
    public Dashboard forUser(long userId) {
        Stats stats = named.queryForObject("""
            select
              (select count(*) from project_members where user_id = :u) as projects,
              (select count(*) from projects where owner_id = :u) as owned,
              (select count(*) from tasks where assignee_id = :u and status <> 'DONE') as open_tasks,
              (select count(*) from applications a join projects p on p.id = a.project_id
                where a.status = 'PENDING'
                  and ((a.kind = 'APPLY' and p.owner_id = :u) or (a.kind = 'INVITE' and a.user_id = :u))) as pending,
              (select count(*) from notifications where user_id = :u and not is_read) as unread,
              (select count(*) from connections where status = 'ACCEPTED'
                and (requester_id = :u or addressee_id = :u)) as connections,
              (select count(*) from posts where author_id = :u) as posts,
              (select coalesce(sum(upvotes), 0) from posts where author_id = :u) as upvotes
            """, Map.of("u", userId),
            (rs, i) -> new Stats(rs.getLong("projects"), rs.getLong("owned"), rs.getLong("open_tasks"),
                rs.getLong("pending"), rs.getLong("unread"), rs.getLong("connections"), rs.getLong("posts"),
                rs.getLong("upvotes")));

        List<Count> tasksByStatus = jdbc.query("""
            select t.status, count(*) as n from tasks t
            join project_members m on m.project_id = t.project_id and m.user_id = ?
            group by t.status
            """, (rs, i) -> new Count(rs.getString("status"), rs.getLong("n")), userId);

        List<TaskItem> myTasks = jdbc.query("""
            select t.id, t.title, t.status, p.id as project_id, p.title as project_title
            from tasks t join projects p on p.id = t.project_id
            where t.assignee_id = ? and t.status <> 'DONE'
            order by t.status desc, t.created_at limit 8
            """, (rs, i) -> new TaskItem(rs.getLong("id"), rs.getString("title"), rs.getString("status"),
            rs.getLong("project_id"), rs.getString("project_title")), userId);

        List<ActivityItem> activity = jdbc.query("""
            select a.id, a.project_id, p.title, a.source, a.summary, a.url, a.created_at
            from project_activity a join projects p on p.id = a.project_id
            join project_members m on m.project_id = a.project_id and m.user_id = ?
            order by a.created_at desc limit 10
            """, (rs, i) -> new ActivityItem(rs.getLong("id"), rs.getLong("project_id"), rs.getString("title"),
            rs.getString("source"), rs.getString("summary"), rs.getString("url"),
            rs.getTimestamp("created_at").toInstant()), userId);

        Platform platform = jdbc.queryForObject("""
            select (select count(*) from users) as students,
                   (select count(*) from projects where status = 'OPEN') as open_projects,
                   (select count(*) from posts where not flagged) as posts
            """, (rs, i) -> new Platform(rs.getLong("students"), rs.getLong("open_projects"), rs.getLong("posts")));

        List<Count> topSkills = jdbc.query("""
            select skill, count(*) as n from user_skills group by skill order by n desc, skill limit 10
            """, (rs, i) -> new Count(rs.getString("skill"), rs.getLong("n")));

        List<Count> categories = jdbc.query("""
            select category, count(*) as n from projects where status <> 'COMPLETED'
            group by category order by n desc limit 8
            """, (rs, i) -> new Count(rs.getString("category"), rs.getLong("n")));

        return new Dashboard(stats, tasksByStatus, myTasks, activity, matches.projectsFor(userId, 3), platform,
            topSkills, categories);
    }
}
