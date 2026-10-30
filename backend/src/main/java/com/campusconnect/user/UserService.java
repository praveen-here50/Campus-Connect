package com.campusconnect.user;

import com.campusconnect.ai.EmbeddingService;
import com.campusconnect.common.Errors;
import com.campusconnect.user.UserDtos.PublicProfile;
import com.campusconnect.user.UserDtos.UpdateProfile;
import com.campusconnect.user.UserDtos.UserProfile;
import com.campusconnect.user.UserDtos.UserSummary;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository users;
    private final EmbeddingService embeddings;

    public UserService(UserRepository users, EmbeddingService embeddings) {
        this.users = users;
        this.embeddings = embeddings;
    }

    @Transactional(readOnly = true)
    public UserProfile profile(long id) {
        return UserProfile.of(users.findById(id).orElseThrow(() -> Errors.notFound("User")));
    }

    @Transactional(readOnly = true)
    public PublicProfile publicProfile(long id) {
        return PublicProfile.of(users.findById(id).orElseThrow(() -> Errors.notFound("User")));
    }

    @Transactional(readOnly = true)
    /** Other students only: the directory is for finding people, not yourself. */
    public List<UserSummary> search(String q, String skill, long viewerId) {
        return users.search(blankToEmpty(q), skill == null || skill.isBlank() ? "" : normalizeSkill(skill))
            .stream().filter(u -> u.getId() != viewerId).map(UserSummary::of).toList();
    }

    @Transactional
    public UserProfile update(long id, UpdateProfile req) {
        User u = users.findById(id).orElseThrow(() -> Errors.notFound("User"));
        u.setFullName(req.fullName().trim());
        u.setHeadline(req.headline());
        u.setBio(req.bio());
        u.setDepartment(req.department());
        u.setYearOfStudy(req.yearOfStudy());
        u.setGithubUrl(blankToNull(req.githubUrl()));
        u.setLinkedinUrl(blankToNull(req.linkedinUrl()));
        u.setPortfolioUrl(blankToNull(req.portfolioUrl()));
        if (req.availability() != null) {
            u.setAvailability(req.availability());
        }
        if (req.skills() != null) {
            u.getSkills().clear();
            req.skills().forEach((skill, level) -> u.getSkills().put(normalizeSkill(skill), level));
        }
        embeddings.refreshUserAfterCommit(id);
        return UserProfile.of(u);
    }

    public static String normalizeSkill(String skill) {
        return skill.trim().toLowerCase(Locale.ROOT);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String blankToEmpty(String s) {
        return s == null || s.isBlank() ? "" : s.trim();
    }
}
