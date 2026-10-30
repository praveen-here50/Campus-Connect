package com.campusconnect.team;

import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByProjectIdOrderByCreatedAtDesc(long projectId, Limit limit);
}
