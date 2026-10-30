package com.campusconnect.user;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ConnectionRepository extends JpaRepository<Connection, Long> {

    @Query("select c from Connection c where c.requesterId = :userId or c.addresseeId = :userId order by c.createdAt desc")
    List<Connection> findInvolving(@Param("userId") long userId);

    @Query("""
        select c from Connection c
        where (c.requesterId = :a and c.addresseeId = :b) or (c.requesterId = :b and c.addresseeId = :a)
        """)
    Optional<Connection> findBetween(@Param("a") long a, @Param("b") long b);
}
