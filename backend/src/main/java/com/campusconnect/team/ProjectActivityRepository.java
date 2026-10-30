package com.campusconnect.team;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectActivityRepository extends JpaRepository<ProjectActivity, Long> {

    List<ProjectActivity> findByProjectIdOrderByCreatedAtDesc(long projectId, Limit limit);

    List<ProjectActivity> findByProjectIdInOrderByCreatedAtDesc(Collection<Long> projectIds, Limit limit);
}
