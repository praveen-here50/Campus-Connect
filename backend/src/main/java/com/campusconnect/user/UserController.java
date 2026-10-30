package com.campusconnect.user;

import com.campusconnect.common.CurrentUser;
import com.campusconnect.common.Errors;
import com.campusconnect.user.UserDtos.PublicProfile;
import com.campusconnect.user.UserDtos.UpdateProfile;
import com.campusconnect.user.UserDtos.UserProfile;
import com.campusconnect.user.UserDtos.UserSummary;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService service;
    private final AvatarService avatars;

    public UserController(UserService service, AvatarService avatars) {
        this.service = service;
        this.avatars = avatars;
    }

    @GetMapping("/me")
    UserProfile me(@AuthenticationPrincipal Jwt jwt) {
        return service.profile(CurrentUser.id(jwt));
    }

    @PutMapping("/me")
    UserProfile update(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateProfile req) {
        return service.update(CurrentUser.id(jwt), req);
    }

    @PostMapping("/me/avatar")
    Map<String, Long> uploadAvatar(@AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
        return Map.of("version", avatars.save(CurrentUser.id(jwt), file));
    }

    @DeleteMapping("/me/avatar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteAvatar(@AuthenticationPrincipal Jwt jwt) {
        avatars.delete(CurrentUser.id(jwt));
    }

    /** Which students have a photo, and its version; the client builds the image URLs from this. */
    @GetMapping("/avatars")
    Map<Long, Long> avatarVersions() {
        return avatars.versions();
    }

    /**
     * The photo itself. Public, because an img tag cannot send the bearer token; the URL carries the
     * version, so browsers can cache it for good and a new upload gets a new URL.
     */
    @GetMapping("/{id}/avatar")
    ResponseEntity<byte[]> avatar(@PathVariable long id) {
        AvatarService.Photo photo = avatars.find(id).orElseThrow(() -> Errors.notFound("Photo"));
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(photo.contentType()))
            .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
            .header("X-Content-Type-Options", "nosniff")
            .header("Content-Security-Policy", "default-src 'none'")
            .body(photo.data());
    }

    @GetMapping
    List<UserSummary> search(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String q,
                             @RequestParam(required = false) String skill) {
        return service.search(q, skill, CurrentUser.id(jwt));
    }

    @GetMapping("/{id}")
    PublicProfile get(@PathVariable long id) {
        return service.publicProfile(id);
    }
}
