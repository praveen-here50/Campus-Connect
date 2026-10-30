package com.campusconnect.team;

import com.campusconnect.common.AfterCommit;
import com.campusconnect.common.Errors;
import com.campusconnect.project.ProjectService;
import com.campusconnect.team.ActivityService.ActivityView;
import com.campusconnect.user.User;
import com.campusconnect.user.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.data.domain.Limit;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The team workspace of a project: chat and activity feed, members only. */
@Service
public class TeamService {

    public record MessageView(long id, long projectId, long senderId, String senderName, String content,
                              Instant createdAt) {
    }

    private final MessageRepository messages;
    private final ProjectActivityRepository activity;
    private final ProjectService projects;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;

    public TeamService(MessageRepository messages, ProjectActivityRepository activity, ProjectService projects,
                       UserRepository users, SimpMessagingTemplate messaging) {
        this.messages = messages;
        this.activity = activity;
        this.projects = projects;
        this.users = users;
        this.messaging = messaging;
    }

    /** The latest 100 messages, oldest first. */
    @Transactional(readOnly = true)
    public List<MessageView> history(long projectId, long userId) {
        projects.requireMember(projectId, userId);
        List<Message> list = new ArrayList<>(messages.findByProjectIdOrderByCreatedAtDesc(projectId, Limit.of(100)));
        Collections.reverse(list);
        Map<Long, User> senders = users.findAllById(list.stream().map(Message::getSenderId).distinct().toList())
            .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return list.stream().map(m -> view(m, senders.get(m.getSenderId()))).toList();
    }

    @Transactional
    public MessageView send(long projectId, long userId, String content) {
        projects.requireMember(projectId, userId);
        if (content == null || content.isBlank()) {
            throw Errors.badRequest("Message cannot be empty");
        }
        if (content.length() > 2000) {
            throw Errors.badRequest("Message is too long (max 2000 characters)");
        }
        Message m = messages.save(new Message(projectId, userId, content.trim()));
        MessageView view = view(m, users.findById(userId).orElse(null));
        AfterCommit.runAsync(() -> messaging.convertAndSend("/topic/projects/" + projectId + "/chat", view));
        return view;
    }

    @Transactional(readOnly = true)
    public List<ActivityView> activity(long projectId, long userId) {
        projects.requireMember(projectId, userId);
        return activity.findByProjectIdOrderByCreatedAtDesc(projectId, Limit.of(50)).stream()
            .map(ActivityView::of).toList();
    }

    private static MessageView view(Message m, User sender) {
        return new MessageView(m.getId(), m.getProjectId(), m.getSenderId(),
            sender == null ? "Former member" : sender.getFullName(), m.getContent(), m.getCreatedAt());
    }
}
