package com.campusconnect.auth;

import com.campusconnect.automation.AutomationEvents;
import com.campusconnect.common.Errors;
import com.campusconnect.user.User;
import com.campusconnect.user.UserDtos.UserProfile;
import com.campusconnect.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterRequest(@NotBlank @Email String email,
                                  @NotBlank @Size(min = 8, max = 100) String password,
                                  @NotBlank @Size(max = 120) String fullName) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {
    }

    public record AuthResponse(String token, UserProfile user) {
    }

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final AutomationEvents automation;

    public AuthController(UserRepository users, PasswordEncoder passwordEncoder, TokenService tokens,
                          AutomationEvents automation) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.automation = automation;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw Errors.conflict("An account with this email already exists");
        }
        User user = users.save(new User(email, passwordEncoder.encode(req.password()), req.fullName().trim()));
        automation.publish("user.registered", Map.of("userId", user.getId(), "name", user.getFullName(),
            "email", user.getEmail()));
        return new AuthResponse(tokens.issue(user.getId(), email), UserProfile.of(user));
    }

    @PostMapping("/login")
    @Transactional(readOnly = true)
    AuthResponse login(@Valid @RequestBody LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
            .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
            .orElseThrow(() -> Errors.badRequest("Invalid email or password"));
        return new AuthResponse(tokens.issue(user.getId(), user.getEmail()), UserProfile.of(user));
    }
}
