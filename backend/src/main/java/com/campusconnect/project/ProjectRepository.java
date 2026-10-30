package com.campusconnect.project;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    /** Empty strings mean "no filter" (a null parameter has no SQL type in PostgreSQL). */
    @Query("""
        select distinct p from Project p left join p.skills s
        where (:q = '' or lower(p.title) like lower(concat('%', :q, '%'))
                       or lower(p.description) like lower(concat('%', :q, '%')))
          and (:skill = '' or s = :skill)
          and (:category = '' or lower(p.category) = lower(:category))
          and (:status = '' or p.status = :status)
        order by p.createdAt desc
        """)
    List<Project> search(@Param("q") String q, @Param("skill") String skill,
                         @Param("category") String category, @Param("status") String status);

    @Query("""
        select p from Project p
        where p.id in (select m.projectId from ProjectMember m where m.userId = :userId)
        order by p.createdAt desc
        """)
    List<Project> findByMember(@Param("userId") long userId);

    List<Project> findByGithubRepoIsNotNull();
}
