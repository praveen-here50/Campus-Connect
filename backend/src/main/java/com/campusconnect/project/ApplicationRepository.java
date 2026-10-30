package com.campusconnect.project;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    Optional<Application> findByProjectIdAndUserId(long projectId, long userId);

    List<Application> findByProjectIdOrderByCreatedAtDesc(long projectId);

    List<Application> findByUserIdOrderByCreatedAtDesc(long userId);

    /** Pending requests the user must decide: applications to their projects and invitations to them. */
    @Query("""
        select a from Application a
        where a.status = 'PENDING'
          and ((a.kind = 'APPLY' and a.projectId in (select p.id from Project p where p.ownerId = :userId))
               or (a.kind = 'INVITE' and a.userId = :userId))
        order by a.createdAt desc
        """)
    List<Application> findIncoming(@Param("userId") long userId);
}
