package com.campusconnect.ai;

import com.campusconnect.common.Errors;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * A cap on AI requests per student per rolling hour (app.ai.questions-per-hour, 0 for none), so one
 * visitor of a public demo cannot use up the shared free Gemini quota for everyone else.
 */
@Component
public class AiUsage {

    private static final long HOUR_MS = 3_600_000;

    private final int perHour;
    private final LongSupplier clock;
    private final Map<Long, Deque<Long>> recent = new ConcurrentHashMap<>();

    @Autowired
    public AiUsage(@Value("${app.ai.questions-per-hour}") int perHour) {
        this(perHour, System::currentTimeMillis);
    }

    AiUsage(int perHour, LongSupplier clock) {
        this.perHour = perHour;
        this.clock = clock;
    }

    /** Counts one request for the student, or fails with 429 and how long to wait. */
    public void charge(long userId) {
        if (perHour <= 0) {
            return;
        }
        Deque<Long> times = recent.computeIfAbsent(userId, id -> new ArrayDeque<>());
        synchronized (times) {
            long now = clock.getAsLong();
            while (!times.isEmpty() && now - times.peekFirst() >= HOUR_MS) {
                times.pollFirst();
            }
            if (times.size() >= perHour) {
                long minutes = Math.max(1, (HOUR_MS - (now - times.peekFirst()) + 59_999) / 60_000);
                throw Errors.tooManyRequests("You have used your " + perHour + " AI requests for this hour. "
                    + "Try again in " + minutes + (minutes == 1 ? " minute." : " minutes."));
            }
            times.addLast(now);
        }
    }
}
