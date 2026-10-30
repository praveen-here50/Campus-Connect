package com.campusconnect.user;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

public final class UserDtos {

    private UserDtos() {
    }

    /** Profile links must be web addresses, so a "javascript:" link can never reach an href. */
    static final String WEB_URL = "^(https?://\\S+)?$";

    public record UserSummary(long id, String fullName, String headline, String department,
                              String availability, Map<String, Short> skills) {
        public static UserSummary of(User u) {
            return new UserSummary(u.getId(), u.getFullName(), u.getHeadline(), u.getDepartment(),
                u.getAvailability(), u.getSkills());
        }
    }

    public record UserProfile(long id, String email, String fullName, String headline, String bio,
                              String department, Short yearOfStudy, String githubUrl, String linkedinUrl,
                              String portfolioUrl, String availability, Map<String, Short> skills) {
        public static UserProfile of(User u) {
            return new UserProfile(u.getId(), u.getEmail(), u.getFullName(), u.getHeadline(), u.getBio(),
                u.getDepartment(), u.getYearOfStudy(), u.getGithubUrl(), u.getLinkedinUrl(),
                u.getPortfolioUrl(), u.getAvailability(), u.getSkills());
        }
    }

    /** Another student's profile as anyone signed in may see it: everything but the email address. */
    public record PublicProfile(long id, String fullName, String headline, String bio, String department,
                                Short yearOfStudy, String githubUrl, String linkedinUrl, String portfolioUrl,
                                String availability, Map<String, Short> skills) {
        public static PublicProfile of(User u) {
            return new PublicProfile(u.getId(), u.getFullName(), u.getHeadline(), u.getBio(), u.getDepartment(),
                u.getYearOfStudy(), u.getGithubUrl(), u.getLinkedinUrl(), u.getPortfolioUrl(),
                u.getAvailability(), u.getSkills());
        }
    }

    public record UpdateProfile(
        @NotBlank @Size(max = 120) String fullName,
        @Size(max = 160) String headline,
        @Size(max = 2000) String bio,
        @Size(max = 120) String department,
        @Min(1) @Max(6) Short yearOfStudy,
        @Size(max = 255) @Pattern(regexp = WEB_URL, message = "must start with https://") String githubUrl,
        @Size(max = 255) @Pattern(regexp = WEB_URL, message = "must start with https://") String linkedinUrl,
        @Size(max = 255) @Pattern(regexp = WEB_URL, message = "must start with https://") String portfolioUrl,
        @Pattern(regexp = "AVAILABLE|LOOKING|BUSY") String availability,
        @Size(max = 30) Map<@NotBlank @Size(max = 60) String, @Min(1) @Max(5) Short> skills) {
    }
}
