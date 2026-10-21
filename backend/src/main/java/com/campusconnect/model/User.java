package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role = "STUDENT";

    // Nullable for backward compatibility with existing database rows.
    // Explicitly false means terminated; OTP verification cannot reactivate it.
    @Column(name = "account_active")
    private Boolean accountActive = true;

    public boolean isAccountActive() { return !Boolean.FALSE.equals(accountActive); }
    public void setAccountActive(boolean active) { this.accountActive = active; }

    // True only after college email verification succeeds.
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    // Records when the email was verified.
    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    public User() {
    }

    public User(
            String name,
            String email,
            String password,
            String role) {

        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;

        // New accounts must verify their email.
        this.emailVerified = false;
    }

    // ======================================
    // GETTERS AND SETTERS
    // ======================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public void setEmailVerifiedAt(Instant emailVerifiedAt) {
        this.emailVerifiedAt = emailVerifiedAt;
    }
}