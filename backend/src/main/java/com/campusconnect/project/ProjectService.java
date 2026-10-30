package com.campusconnect.project;

import com.campusconnect.ai.EmbeddingService;
import com.campusconnect.automation.AutomationEvents;
import com.campusconnect.common.Errors;
import com.campusconnect.notification.NotificationService;
import com.campusconnect.project.ProjectDtos.ApplicationView;
import com.campusconnect.project.ProjectDtos.ApplyRequest;
import com.campusconnect.project.ProjectDtos.InviteRequest;
import com.campusconnect.project.ProjectDtos.MemberView;
import com.campusconnect.project.ProjectDtos.ProjectDetail;
import com.campusconnect.project.ProjectDtos.ProjectSummary;
import com.campusconnect.project.ProjectDtos.SaveProject;
import com.campusconnect.team.ActivityService;
import com.campusconnect.user.User;
import com.campusconnect.user.UserRepository;
import com.campusconnect.user.UserService;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final ApplicationRepository applications;
    private final TaskRepository tasks;
    private final UserRepository users;
    private final EmbeddingService embeddings;
    private final AutomationEvents automation;
    private final NotificationService notifications;
    private final ActivityService activity;

    public ProjectService(ProjectRepository projects, ProjectMemberRepository members,
                          ApplicationRepository applications, TaskRepository tasks, UserRepository users,
                          EmbeddingService embeddings, AutomationEvents automation,
                          NotificationService notifications, ActivityService activity) {
        this.projects = projects;
        this.members = members;
        this.applications = applications;
        this.tasks = tasks;
        this.users = users;
        this.embeddings = embeddings;
        this.automation = automation;
        this.notifications = notifications;
        this.activity = activity;
    }

    // ---- projects ----

    @Transactional(readOnly = true)
    /** Projects to discover: the viewer's own teams (started or joined) are listed under "Your teams" instead. */
    public List<ProjectSummary> search(String q, String skill, String category, String status, long viewerId) {
        Set<Long> mine = projects.findByMember(viewerId).stream().map(Project::getId).collect(Collectors.toSet());
        return summariesOf(projects.search(blankToEmpty(q),
            skill == null || skill.isBlank() ? "" : UserService.normalizeSkill(skill),
            blankToEmpty(category), blankToEmpty(status)).stream().filter(p -> !mine.contains(p.getId())).toList());
    }

    @Transactional(readOnly = true)
    public List<ProjectSummary> mine(long userId) {
        return summariesOf(projects.findByMember(userId));
    }

    @Transactional(readOnly = true)
    public ProjectDetail detail(long projectId, long viewerId) {
        Project p = find(projectId);
        List<ProjectMember> team = members.findByProjectIdOrderByJoinedAt(projectId);
        Map<Long, User> people = usersById(team.stream().map(ProjectMember::getUserId).toList());
        List<MemberView> memberViews = team.stream().map(m -> {
            User u = people.get(m.getUserId());
            return new MemberView(m.getUserId(), u.getFullName(), u.getHeadline(), m.getRole(), m.getJoinedAt());
        }).toList();
        String myRole = team.stream().filter(m -> m.getUserId() == viewerId)
            .map(ProjectMember::getRole).findFirst().orElse(null);
        ApplicationView myRequest = applications.findByProjectIdAndUserId(projectId, viewerId)
            .filter(a -> Application.PENDING.equals(a.getStatus()))
            .map(a -> view(a, p, users.findById(viewerId).orElseThrow()))
            .orElse(null);
        return new ProjectDetail(p.getId(), p.getTitle(), p.getDescription(), p.getCategory(), p.getStatus(),
            p.getMaxMembers(), p.getGithubRepo(), p.getOwnerId(), p.getSkills(), memberViews, p.getCreatedAt(),
            myRole, myRequest);
    }

    @Transactional
    public ProjectDetail create(long ownerId, SaveProject req) {
        Project p = new Project(ownerId);
        apply(p, req);
        projects.save(p);
        members.save(new ProjectMember(p.getId(), ownerId, ProjectMember.OWNER));
        embeddings.refreshProjectAfterCommit(p.getId());
        automation.publish("project.created", Map.of("projectId", p.getId(), "ownerId", ownerId,
            "title", p.getTitle(), "skills", p.getSkills()));
        return detail(p.getId(), ownerId);
    }

    @Transactional
    public ProjectDetail update(long projectId, long userId, SaveProject req) {
        Project p = requireOwner(projectId, userId);
        if (req.maxMembers() != null && req.maxMembers() < members.countByProjectId(projectId)) {
            throw Errors.badRequest("maxMembers cannot be lower than the current team size");
        }
        apply(p, req);
        embeddings.refreshProjectAfterCommit(projectId);
        return detail(projectId, userId);
    }

    @Transactional
    public void delete(long projectId, long userId) {
        projects.delete(requireOwner(projectId, userId));
    }

    // ---- membership ----

    /** The owner removes a member, or a member leaves. The owner cannot leave their own project. */
    @Transactional
    public void removeMember(long projectId, long callerId, long memberId) {
        Project p = find(projectId);
        boolean isOwner = p.getOwnerId() == callerId;
        if (!isOwner && callerId != memberId) {
            throw Errors.forbidden("Only the project owner can remove other members");
        }
        if (p.getOwnerId() == memberId) {
            throw Errors.badRequest("The owner cannot leave the project; delete it instead");
        }
        ProjectMember m = members.findByProjectIdAndUserId(projectId, memberId)
            .orElseThrow(() -> Errors.notFound("Member"));
        members.delete(m);
        String name = users.findById(memberId).map(User::getFullName).orElse("A member");
        activity.record(projectId, "SYSTEM", name + (callerId == memberId ? " left the team" : " was removed"), null);
        if (callerId != memberId) {
            notifications.notify(memberId, "MEMBER_REMOVED", "You were removed from " + p.getTitle(), "/projects");
        }
        tasks.findByProjectIdOrderByCreatedAt(projectId).stream()
            .filter(t -> t.getAssigneeId() != null && t.getAssigneeId() == memberId)
            .forEach(t -> t.setAssigneeId(null));
    }

    // ---- applications and invites ----

    @Transactional
    public ApplicationView applyTo(long projectId, long userId, ApplyRequest req) {
        Project p = find(projectId);
        if (!"OPEN".equals(p.getStatus())) {
            throw Errors.badRequest("This project is not accepting new members");
        }
        Application a = openRequest(projectId, userId, Application.APPLY, req.message());
        User applicant = users.findById(userId).orElseThrow();
        notifications.notify(p.getOwnerId(), "APPLICATION",
            applicant.getFullName() + " applied to join " + p.getTitle(), "/projects/" + projectId);
        User owner = users.findById(p.getOwnerId()).orElseThrow();
        automation.publish("project.application", Map.of("projectId", projectId, "title", p.getTitle(),
            "ownerEmail", owner.getEmail(), "ownerName", owner.getFullName(),
            "applicantName", applicant.getFullName(), "message", req.message() == null ? "" : req.message()));
        return view(a, p, applicant);
    }

    @Transactional
    public ApplicationView invite(long projectId, long ownerId, InviteRequest req) {
        Project p = requireOwner(projectId, ownerId);
        User invitee = users.findById(req.userId()).orElseThrow(() -> Errors.notFound("User"));
        Application a = openRequest(projectId, invitee.getId(), Application.INVITE, req.message());
        notifications.notify(invitee.getId(), "INVITE", "You were invited to join " + p.getTitle(),
            "/projects/" + projectId);
        automation.publish("project.invite", Map.of("projectId", projectId, "title", p.getTitle(),
            "inviteeEmail", invitee.getEmail(), "inviteeName", invitee.getFullName(),
            "ownerName", users.findById(ownerId).map(User::getFullName).orElse("A student")));
        return view(a, p, invitee);
    }

    /** Owner only: everything sent to or from this project. */
    @Transactional(readOnly = true)
    public List<ApplicationView> forProject(long projectId, long ownerId) {
        Project p = requireOwner(projectId, ownerId);
        List<Application> list = applications.findByProjectIdOrderByCreatedAtDesc(projectId);
        Map<Long, User> people = usersById(list.stream().map(Application::getUserId).toList());
        return list.stream().map(a -> view(a, p, people.get(a.getUserId()))).toList();
    }

    /** The caller's own applications and the invitations they received. */
    @Transactional(readOnly = true)
    public List<ApplicationView> forUser(long userId) {
        List<Application> list = applications.findByUserIdOrderByCreatedAtDesc(userId);
        Map<Long, Project> byId = projects.findAllById(list.stream().map(Application::getProjectId).toList())
            .stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        User me = users.findById(userId).orElseThrow(() -> Errors.notFound("User"));
        return list.stream().map(a -> view(a, byId.get(a.getProjectId()), me)).toList();
    }

    /** Everything waiting on the caller's answer, newest first. */
    @Transactional(readOnly = true)
    public List<ApplicationView> incoming(long userId) {
        List<Application> list = applications.findIncoming(userId);
        Map<Long, Project> byId = projects.findAllById(list.stream().map(Application::getProjectId).toList())
            .stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        Map<Long, User> people = usersById(list.stream().map(Application::getUserId).toList());
        return list.stream().map(a -> view(a, byId.get(a.getProjectId()), people.get(a.getUserId()))).toList();
    }

    /** Applications are decided by the owner, invitations by the invited student. */
    @Transactional
    public ApplicationView decide(long applicationId, long callerId, boolean accept) {
        Application a = applications.findById(applicationId).orElseThrow(() -> Errors.notFound("Application"));
        Project p = find(a.getProjectId());
        long decider = Application.APPLY.equals(a.getKind()) ? p.getOwnerId() : a.getUserId();
        if (decider != callerId) {
            throw Errors.forbidden("You cannot decide on this request");
        }
        if (!Application.PENDING.equals(a.getStatus())) {
            throw Errors.conflict("This request was already decided");
        }
        if (accept) {
            if ("COMPLETED".equals(p.getStatus())) {
                throw Errors.badRequest("This project is completed");
            }
            if (members.countByProjectId(p.getId()) >= p.getMaxMembers()) {
                throw Errors.conflict("The team is already full");
            }
            members.save(new ProjectMember(p.getId(), a.getUserId(), ProjectMember.MEMBER));
            activity.record(p.getId(), "SYSTEM",
                users.findById(a.getUserId()).map(User::getFullName).orElse("A student") + " joined the team", null);
            User joined = users.findById(a.getUserId()).orElseThrow();
            automation.publish("project.member_joined", Map.of("projectId", p.getId(), "title", p.getTitle(),
                "memberEmail", joined.getEmail(), "memberName", joined.getFullName()));
        }
        a.setStatus(accept ? Application.ACCEPTED : Application.REJECTED);
        long other = Application.APPLY.equals(a.getKind()) ? a.getUserId() : p.getOwnerId();
        String who = Application.APPLY.equals(a.getKind()) ? "Your application to " + p.getTitle()
            : users.findById(a.getUserId()).map(User::getFullName).orElse("A student") + "'s invitation to "
                + p.getTitle();
        notifications.notify(other, accept ? "REQUEST_ACCEPTED" : "REQUEST_REJECTED",
            who + (accept ? " was accepted" : " was declined"), "/projects/" + p.getId());
        return view(a, p, users.findById(a.getUserId()).orElseThrow());
    }

    /** The sender takes back a pending request: the applicant for APPLY, the owner for INVITE. */
    @Transactional
    public void withdraw(long applicationId, long callerId) {
        Application a = applications.findById(applicationId).orElseThrow(() -> Errors.notFound("Application"));
        long sender = Application.APPLY.equals(a.getKind()) ? a.getUserId() : find(a.getProjectId()).getOwnerId();
        if (sender != callerId) {
            throw Errors.forbidden("You cannot withdraw this request");
        }
        if (!Application.PENDING.equals(a.getStatus())) {
            throw Errors.conflict("This request was already decided");
        }
        applications.delete(a);
    }

    // ---- access checks shared with tasks and the team workspace ----

    public Project find(long projectId) {
        return projects.findById(projectId).orElseThrow(() -> Errors.notFound("Project"));
    }

    public Project requireOwner(long projectId, long userId) {
        Project p = find(projectId);
        if (p.getOwnerId() != userId) {
            throw Errors.forbidden("Only the project owner can do this");
        }
        return p;
    }

    public void requireMember(long projectId, long userId) {
        if (!members.existsByProjectIdAndUserId(projectId, userId)) {
            if (!projects.existsById(projectId)) {
                throw Errors.notFound("Project");
            }
            throw Errors.forbidden("Only project members can do this");
        }
    }

    public boolean isMember(long projectId, long userId) {
        return members.existsByProjectIdAndUserId(projectId, userId);
    }

    // ---- helpers ----

    private Application openRequest(long projectId, long userId, String kind, String message) {
        if (members.existsByProjectIdAndUserId(projectId, userId)) {
            throw Errors.conflict("Already a member of this project");
        }
        Application a = applications.findByProjectIdAndUserId(projectId, userId).orElse(null);
        if (a == null) {
            return applications.save(new Application(projectId, userId, kind, message));
        }
        if (Application.PENDING.equals(a.getStatus())) {
            throw Errors.conflict(Application.APPLY.equals(a.getKind())
                ? "There is already a pending application" : "There is already a pending invitation");
        }
        a.reopen(kind, message);
        return a;
    }

    private static void apply(Project p, SaveProject req) {
        p.setTitle(req.title().trim());
        p.setDescription(req.description().trim());
        p.setCategory(req.category().trim());
        if (req.status() != null) {
            p.setStatus(req.status());
        }
        if (req.maxMembers() != null) {
            p.setMaxMembers(req.maxMembers());
        }
        p.setGithubRepo(blankToNull(req.githubRepo()));
        if (req.skills() != null) {
            p.getSkills().clear();
            req.skills().forEach(s -> p.getSkills().add(UserService.normalizeSkill(s)));
        }
    }

    public List<ProjectSummary> summariesOf(List<Project> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        List<Long> ids = list.stream().map(Project::getId).toList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : members.countByProjectIds(ids)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        Map<Long, User> owners = usersById(list.stream().map(Project::getOwnerId).toList());
        return list.stream().map(p -> new ProjectSummary(p.getId(), p.getTitle(), p.getCategory(), p.getStatus(),
            p.getMaxMembers(), counts.getOrDefault(p.getId(), 0L), p.getSkills(), p.getOwnerId(),
            owners.get(p.getOwnerId()).getFullName(), p.getCreatedAt())).toList();
    }

    private Map<Long, User> usersById(Collection<Long> ids) {
        return users.findAllById(ids.stream().distinct().toList()).stream()
            .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static ApplicationView view(Application a, Project p, User u) {
        return new ApplicationView(a.getId(), p.getId(), p.getTitle(), u.getId(), u.getFullName(), a.getKind(),
            a.getMessage(), a.getStatus(), a.getCreatedAt());
    }

    private static String blankToEmpty(String s) {
        return s == null || s.isBlank() ? "" : s.trim();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
