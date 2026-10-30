package com.campusconnect.knowledge;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {

    /** Flagged posts stay visible to their author only. sort is "new" or "top"; "" and 0 mean "no filter". */
    @Query(nativeQuery = true, value = """
        select p.* from posts p
        where (not p.flagged or p.author_id = :viewer)
          and (:q = '' or p.title ilike '%' || :q || '%' or p.body ilike '%' || :q || '%')
          and (:tag = '' or :tag = any(p.tags))
          and (:author = 0 or p.author_id = :author)
        order by case when :sort = 'top' then p.upvotes end desc nulls last, p.created_at desc
        limit 50
        """)
    List<Post> search(@Param("q") String q, @Param("tag") String tag, @Param("author") long author,
                      @Param("sort") String sort, @Param("viewer") long viewer);
}
