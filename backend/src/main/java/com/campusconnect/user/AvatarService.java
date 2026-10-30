package com.campusconnect.user;

import com.campusconnect.common.Errors;
import java.io.IOException;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile photos. Only JPEG, PNG and WebP are accepted, checked by their first bytes rather than the
 * declared type, so an SVG or HTML file renamed to .png is refused and nothing scriptable is ever served.
 */
@Service
public class AvatarService {

    static final int MAX_BYTES = 2 * 1024 * 1024;

    public record Photo(String contentType, byte[] data, long version) {
    }

    private final JdbcTemplate jdbc;

    public AvatarService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Stores the photo and returns its new version, which the client puts in the image URL. */
    public long save(long userId, MultipartFile file) {
        if (file.isEmpty()) {
            throw Errors.badRequest("Choose a photo to upload");
        }
        if (file.getSize() > MAX_BYTES) {
            throw Errors.badRequest("The photo must be 2 MB or smaller");
        }
        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw Errors.badRequest("Could not read the photo");
        }
        String type = sniff(data).orElseThrow(() -> Errors.badRequest("Upload a JPEG, PNG or WebP image"));
        Timestamp now = new Timestamp(System.currentTimeMillis());
        jdbc.update("""
            insert into user_avatars (user_id, content_type, data, updated_at) values (?, ?, ?, ?)
            on conflict (user_id) do update set content_type = excluded.content_type, data = excluded.data,
                updated_at = excluded.updated_at
            """, userId, type, data, now);
        return now.getTime();
    }

    public void delete(long userId) {
        jdbc.update("delete from user_avatars where user_id = ?", userId);
    }

    public Optional<Photo> find(long userId) {
        return jdbc.query("select content_type, data, updated_at from user_avatars where user_id = ?",
            (rs, i) -> new Photo(rs.getString(1), rs.getBytes(2), rs.getTimestamp(3).getTime()), userId)
            .stream().findFirst();
    }

    /** user id -> photo version, for every student who has a photo (without the image bytes). */
    public Map<Long, Long> versions() {
        Map<Long, Long> versions = new HashMap<>();
        jdbc.query("select user_id, updated_at from user_avatars",
            rs -> {
                versions.put(rs.getLong(1), rs.getTimestamp(2).getTime());
            });
        return versions;
    }

    static Optional<String> sniff(byte[] d) {
        if (d.length > 3 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF) {
            return Optional.of("image/jpeg");
        }
        if (d.length > 8 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') {
            return Optional.of("image/png");
        }
        if (d.length > 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
            && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') {
            return Optional.of("image/webp");
        }
        return Optional.empty();
    }
}
