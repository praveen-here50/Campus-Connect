package com.campusconnect.user;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class AvatarServiceTest {

    private static byte[] bytes(int... values) {
        byte[] b = new byte[16];
        for (int i = 0; i < values.length; i++) {
            b[i] = (byte) values[i];
        }
        return b;
    }

    @Test
    void recognisesJpegPngAndWebpByTheirFirstBytes() {
        assertThat(AvatarService.sniff(bytes(0xFF, 0xD8, 0xFF, 0xE0))).contains("image/jpeg");
        assertThat(AvatarService.sniff(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A))).contains("image/png");
        assertThat(AvatarService.sniff(bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'))).contains("image/webp");
    }

    @Test
    void refusesAnSvgOrHtmlFileWhateverItIsCalled() {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes(StandardCharsets.UTF_8);
        byte[] html = "<!doctype html><html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8);
        assertThat(AvatarService.sniff(svg)).isEmpty();
        assertThat(AvatarService.sniff(html)).isEmpty();
    }

    @Test
    void refusesFilesTooShortToCarryASignature() {
        assertThat(AvatarService.sniff(new byte[] {(byte) 0xFF, (byte) 0xD8})).isEmpty();
        assertThat(AvatarService.sniff(new byte[0])).isEmpty();
    }
}
