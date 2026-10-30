package com.campusconnect.ai;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class AiUsageTest {

    private final AtomicLong now = new AtomicLong(1_000_000);

    @Test
    void allowsTheLimitThenRefusesWithHowLongToWait() {
        AiUsage usage = new AiUsage(3, now::get);
        for (int i = 0; i < 3; i++) {
            usage.charge(7);
            now.addAndGet(60_000);
        }
        assertThatThrownBy(() -> usage.charge(7))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> {
                ResponseStatusException r = (ResponseStatusException) e;
                org.assertj.core.api.Assertions.assertThat(r.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
                org.assertj.core.api.Assertions.assertThat(r.getReason()).contains("3 AI requests").contains("57 minutes");
            });
    }

    @Test
    void anHourAfterTheFirstRequestThereIsRoomAgain() {
        AiUsage usage = new AiUsage(2, now::get);
        usage.charge(7);
        now.addAndGet(10 * 60_000);
        usage.charge(7);
        now.addAndGet(50 * 60_000);
        assertThatCode(() -> usage.charge(7)).doesNotThrowAnyException();
        assertThatThrownBy(() -> usage.charge(7)).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void eachStudentHasTheirOwnAllowance() {
        AiUsage usage = new AiUsage(1, now::get);
        usage.charge(1);
        assertThatCode(() -> usage.charge(2)).doesNotThrowAnyException();
        assertThatThrownBy(() -> usage.charge(1)).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void zeroMeansNoLimit() {
        AiUsage usage = new AiUsage(0, now::get);
        assertThatCode(() -> {
            for (int i = 0; i < 100; i++) {
                usage.charge(1);
            }
        }).doesNotThrowAnyException();
    }
}
