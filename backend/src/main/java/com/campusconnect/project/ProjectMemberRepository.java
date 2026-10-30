package com.campusconnect.project;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMember.Key> {

    List<ProjectMember> findByProjectIdOrderByJoinedAt(long projectId);

    Optional<ProjectMember> findByProjectIdAndUserId(long projectId, long userId);

    boolean existsByProjectIdAndUserId(long projectId, long userId);

    long countByProjectId(long projectId);

    @Query("select m.projectId, count(m) from ProjectMember m where m.projectId in :ids group by m.projectId")
    List<Object[]> countByProjectIds(@Param("ids") Collection<Long> ids);
}
