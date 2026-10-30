package com.campusconnect.user;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "connections")
public class Connection {

    public static final String PENDING = "PENDING";
    public static final String ACCEPTED = "ACCEPTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long requesterId;
    private Long addresseeId;
    private String status = PENDING;
    private Instant createdAt = Instant.now();

    protected Connection() {
    }

    public Connection(Long requesterId, Long addresseeId) {
        this.requesterId = requesterId;
        this.addresseeId = addresseeId;
    }

    public long otherThan(long userId) {
        return requesterId == userId ? addresseeId : requesterId;
    }

    public Long getId() { return id; }
    public Long getRequesterId() { return requesterId; }
    public Long getAddresseeId() { return addresseeId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
