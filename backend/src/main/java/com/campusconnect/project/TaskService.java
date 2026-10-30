package com.campusconnect.project;

import com.campusconnect.common.Errors;
import com.campusconnect.project.ProjectDtos.SaveTask;
import com.campusconnect.project.ProjectDtos.TaskView;
import com.campusconnect.team.ActivityService;
import com.campusconnect.user.User;
import com.campusconnect.user.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The project's task board; every member can read and change it. */
@Service
public class TaskService {

    private final TaskRepository tasks;
    private final ProjectService projects;
    private final UserRepository users;
    private final ActivityService activity;

    public TaskService(TaskRepository tasks, ProjectService projects, UserRepository users,
                       ActivityService activity) {
        this.tasks = tasks;
        this.projects = projects;
        this.users = users;
        this.activity = activity;
    }

    @Transactional(readOnly = true)
    public List<TaskView> list(long projectId, long userId) {
        projects.requireMember(projectId, userId);
        List<Task> list = tasks.findByProjectIdOrderByCreatedAt(projectId);
        Map<Long, User> assignees = users.findAllById(list.stream().map(Task::getAssigneeId)
                .filter(id -> id != null).distinct().toList())
            .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return list.stream().map(t -> view(t, assignees.get(t.getAssigneeId()))).toList();
    }

    @Transactional
    public TaskView create(long projectId, long userId, SaveTask req) {
        projects.requireMember(projectId, userId);
        Task t = new Task(projectId, req.title().trim());
        apply(t, req);
        return view(tasks.save(t), assignee(t));
    }

    @Transactional
    public TaskView update(long taskId, long userId, SaveTask req) {
        Task t = find(taskId, userId);
        boolean wasDone = "DONE".equals(t.getStatus());
        t.setTitle(req.title().trim());
        apply(t, req);
        if (!wasDone && "DONE".equals(t.getStatus())) {
            String who = users.findById(userId).map(User::getFullName).orElse("Someone");
            activity.record(t.getProjectId(), "SYSTEM", who + " completed \"" + t.getTitle() + "\"", null);
        }
        return view(t, assignee(t));
    }

    @Transactional
    public void delete(long taskId, long userId) {
        tasks.delete(find(taskId, userId));
    }

    private Task find(long taskId, long userId) {
        Task t = tasks.findById(taskId).orElseThrow(() -> Errors.notFound("Task"));
        projects.requireMember(t.getProjectId(), userId);
        return t;
    }

    private void apply(Task t, SaveTask req) {
        if (req.status() != null) {
            t.setStatus(req.status());
        }
        if (req.assigneeId() != null && !projects.isMember(t.getProjectId(), req.assigneeId())) {
            throw Errors.badRequest("Tasks can only be assigned to project members");
        }
        t.setAssigneeId(req.assigneeId());
    }

    private User assignee(Task t) {
        return t.getAssigneeId() == null ? null : users.findById(t.getAssigneeId()).orElse(null);
    }

    private static TaskView view(Task t, User assignee) {
        return new TaskView(t.getId(), t.getTitle(), t.getStatus(), t.getAssigneeId(),
            assignee == null ? null : assignee.getFullName(), t.getCreatedAt());
    }
}
