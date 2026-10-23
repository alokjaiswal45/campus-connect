package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "password_resets", indexes = @Index(name = "idx_password_reset_email_created", columnList = "email,created_at"))
public class PasswordReset {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(nullable = false, length = 254) public String email;
    @Column(nullable = false) public String codeHash;
    @Column(name = "created_at", nullable = false) public Instant createdAt;
    @Column(nullable = false) public Instant expiresAt;
    @Column(nullable = false) public int attempts;
    @Column(nullable = false) public boolean used;
}
