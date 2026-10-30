package com.campusconnect.user;

import com.campusconnect.common.Errors;
import com.campusconnect.notification.NotificationService;
import com.campusconnect.user.UserDtos.UserSummary;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Peer networking: students send, accept and remove connection requests. */
@Service
public class ConnectionService {

    /** direction is INCOMING or OUTGOING from the caller's point of view. */
    public record ConnectionView(long id, UserSummary user, String status, String direction, Instant createdAt) {
    }

    private final ConnectionRepository connections;
    private final UserRepository users;
    private final NotificationService notifications;

    public ConnectionService(ConnectionRepository connections, UserRepository users,
                             NotificationService notifications) {
        this.connections = connections;
        this.users = users;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<ConnectionView> list(long userId) {
        List<Connection> list = connections.findInvolving(userId);
        Map<Long, User> people = users.findAllById(list.stream().map(c -> c.otherThan(userId)).toList())
            .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return list.stream().map(c -> view(c, userId, people.get(c.otherThan(userId)))).toList();
    }

    /** Sends a request; if the other student already sent one to us, this accepts theirs instead. */
    @Transactional
    public ConnectionView request(long userId, long targetId) {
        if (userId == targetId) {
            throw Errors.badRequest("You cannot connect with yourself");
        }
        User target = users.findById(targetId).orElseThrow(() -> Errors.notFound("User"));
        Connection existing = connections.findBetween(userId, targetId).orElse(null);
        if (existing != null) {
            if (Connection.PENDING.equals(existing.getStatus()) && existing.getAddresseeId() == userId) {
                return accept(existing.getId(), userId);
            }
            throw Errors.conflict(Connection.ACCEPTED.equals(existing.getStatus())
                ? "You are already connected" : "A connection request is already pending");
        }
        Connection c = connections.save(new Connection(userId, targetId));
        notifications.notify(targetId, "CONNECTION_REQUEST", nameOf(userId) + " wants to connect with you",
            "/network");
        return view(c, userId, target);
    }

    @Transactional
    public ConnectionView accept(long connectionId, long userId) {
        Connection c = connections.findById(connectionId)
            .filter(x -> x.getAddresseeId() == userId)
            .orElseThrow(() -> Errors.notFound("Connection request"));
        if (!Connection.PENDING.equals(c.getStatus())) {
            throw Errors.conflict("This request was already accepted");
        }
        c.setStatus(Connection.ACCEPTED);
        notifications.notify(c.getRequesterId(), "CONNECTION_ACCEPTED",
            nameOf(userId) + " accepted your connection request", "/users/" + userId);
        return view(c, userId, users.findById(c.getRequesterId()).orElseThrow());
    }

    /** Declines, cancels or removes a connection; either side may do this. */
    @Transactional
    public void remove(long connectionId, long userId) {
        Connection c = connections.findById(connectionId)
            .filter(x -> x.getRequesterId() == userId || x.getAddresseeId() == userId)
            .orElseThrow(() -> Errors.notFound("Connection"));
        connections.delete(c);
    }

    private String nameOf(long userId) {
        return users.findById(userId).map(User::getFullName).orElse("A student");
    }

    private static ConnectionView view(Connection c, long userId, User other) {
        return new ConnectionView(c.getId(), UserSummary.of(other), c.getStatus(),
            c.getRequesterId() == userId ? "OUTGOING" : "INCOMING", c.getCreatedAt());
    }
}
