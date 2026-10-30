package com.campusconnect.user;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;
    private String passwordHash;
    private String fullName;
    private String headline;
    private String bio;
    private String department;
    private Short yearOfStudy;
    private String githubUrl;
    private String linkedinUrl;
    private String portfolioUrl;
    private String availability = "AVAILABLE";
    private Instant createdAt = Instant.now();

    /** skill name (lower-case) -> level 1..5 */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_skills", joinColumns = @JoinColumn(name = "user_id"))
    @MapKeyColumn(name = "skill")
    @Column(name = "level")
    private Map<String, Short> skills = new HashMap<>();

    protected User() {
    }

    public User(String email, String passwordHash, String fullName) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public Short getYearOfStudy() { return yearOfStudy; }
    public void setYearOfStudy(Short yearOfStudy) { this.yearOfStudy = yearOfStudy; }
    public String getGithubUrl() { return githubUrl; }
    public void setGithubUrl(String githubUrl) { this.githubUrl = githubUrl; }
    public String getLinkedinUrl() { return linkedinUrl; }
    public void setLinkedinUrl(String linkedinUrl) { this.linkedinUrl = linkedinUrl; }
    public String getPortfolioUrl() { return portfolioUrl; }
    public void setPortfolioUrl(String portfolioUrl) { this.portfolioUrl = portfolioUrl; }
    public String getAvailability() { return availability; }
    public void setAvailability(String availability) { this.availability = availability; }
    public Instant getCreatedAt() { return createdAt; }
    public Map<String, Short> getSkills() { return skills; }
}
