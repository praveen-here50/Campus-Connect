package com.campusconnect.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /** Empty strings mean "no filter" (a null parameter has no SQL type in PostgreSQL). */
    @Query("""
        select distinct u from User u left join u.skills s
        where (:q = '' or lower(u.fullName) like lower(concat('%', :q, '%'))
                       or lower(u.headline) like lower(concat('%', :q, '%')))
          and (:skill = '' or key(s) = :skill)
        order by u.fullName
        """)
    List<User> search(@Param("q") String q, @Param("skill") String skill);
}
