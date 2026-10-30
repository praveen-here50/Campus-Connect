package com.campusconnect.knowledge;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    List<Comment> findByPostIdOrderByCreatedAt(long postId);

    @Query("select c.postId, count(c) from Comment c where c.postId in :ids group by c.postId")
    List<Object[]> countByPostIds(@Param("ids") Collection<Long> ids);
}
