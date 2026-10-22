package com.campusconnect.service;

import com.campusconnect.model.PasswordReset;
import com.campusconnect.model.User;
import com.campusconnect.repo.PasswordResetRepository;
import com.campusconnect.repo.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class StudentPasswordService {
    private static final Logger log = LoggerFactory.getLogger(StudentPasswordService.class);
    private static final SecureRandom random = new SecureRandom();
    private final UserRepository users;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final JavaMailSender mail;
    private final String sender;
    private final String domain;
    private final java.util.concurrent.Executor notificationExecutor;

    public StudentPasswordService(UserRepository users, PasswordResetRepository resets,
            PasswordEncoder encoder, JavaMailSender mail,
            @Value("${spring.mail.username:}") String sender,
            @Value("${app.allowed-email-domain:bmsce.ac.in}") String domain,
            @org.springframework.beans.factory.annotation.Qualifier("passwordMailExecutor") java.util.concurrent.Executor notificationExecutor) {
        this.users = users; this.resets = resets; this.encoder = encoder; this.mail = mail;
        this.sender = sender;
        this.notificationExecutor = notificationExecutor;
        this.domain = domain.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
    }

    public static boolean validPassword(String password) {
        return password != null && password.length() >= 8
                && password.getBytes(StandardCharsets.UTF_8).length <= 72;
    }

    private String normalize(String email) {
        if (email == null || email.length() > 254) return "";
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        return normalized.matches("^[a-z0-9._%+-]+@" + Pattern.quote(domain) + "$") ? normalized : "";
    }

    private Optional<User> eligibleAccount(String email) {
        if (email.isEmpty()) return Optional.empty();
        return users.lockByEmail(email).filter(u -> java.util.Set.of("STUDENT", "TEACHER", "STAFF").contains(u.getRole())
                && u.isAccountActive() && u.isEmailVerified());
    }

    @Transactional
    public void requestReset(String email) {
        String normalized = normalize(email);
        Optional<User> eligible = eligibleAccount(normalized);
        if (eligible.isEmpty()) return; // Same public response for every account state.
        Instant now = Instant.now();
        if (resets.countByEmailAndCreatedAtAfter(normalized, now.minus(Duration.ofHours(1))) >= 5) return;
        Optional<PasswordReset> latest = resets.findFirstByEmailOrderByCreatedAtDescIdDesc(normalized);
        if (latest.isPresent() && latest.get().createdAt.isAfter(now.minusSeconds(60))) return;
        String code = String.format(Locale.ROOT, "%06d", random.nextInt(1_000_000));
        resets.invalidateAll(normalized);
        PasswordReset reset = new PasswordReset();
        reset.email = normalized;
        reset.codeHash = encoder.encode(code);
        reset.createdAt = now;
        reset.expiresAt = now.plusSeconds(300);
        resets.saveAndFlush(reset);
        // A failed SMTP submission rolls back this request, including invalidation of older codes.
        send(normalized, "Campus Connect - Password reset OTP",
                "Your password reset code is: " + code + "\n\nIt expires in 5 minutes and can be used once. "
                + "Do not share this code. If you did not request a password reset, ignore this email.");
        log.info("Account password reset code issued for account id={}", eligible.get().getId());
    }

    @Transactional
    public boolean reset(String email, String code, String newPassword) {
        if (!validPassword(newPassword) || code == null || !code.matches("[0-9]{6}")) return false;
        Optional<User> eligible = eligibleAccount(normalize(email));
        if (eligible.isEmpty()) return false;
        User user = eligible.get();
        Optional<PasswordReset> latest = resets.findFirstByEmailOrderByCreatedAtDescIdDesc(user.getEmail().toLowerCase(Locale.ROOT));
        if (latest.isEmpty()) return false;
        PasswordReset reset = latest.get();
        if (reset.used || reset.attempts >= 5 || !Instant.now().isBefore(reset.expiresAt)) return false;
        reset.attempts++;
        resets.save(reset); // Return false rather than throw so incorrect-attempt counters commit.
        if (!encoder.matches(code, reset.codeHash) || encoder.matches(newPassword, user.getPassword())) return false;
        replace(user, newPassword, "email OTP reset");
        return true;
    }

    @Transactional
    public boolean change(String email, String currentPassword, String newPassword) {
        if (!validPassword(newPassword) || currentPassword == null
                || currentPassword.getBytes(StandardCharsets.UTF_8).length > 72) return false;
        Optional<User> eligible = eligibleAccount(normalize(email)).filter(u -> "STUDENT".equals(u.getRole()));
        if (eligible.isEmpty()) return false;
        User user = eligible.get();
        if (!encoder.matches(currentPassword, user.getPassword()) || encoder.matches(newPassword, user.getPassword())) return false;
        replace(user, newPassword, "authenticated password change");
        return true;
    }

    private void replace(User user, String newPassword, String action) {
        user.setPassword(encoder.encode(newPassword));
        users.saveAndFlush(user);
        resets.invalidateAll(user.getEmail().toLowerCase(Locale.ROOT));
        // Stateless Basic authentication reloads the user's hash on each request:
        // all clients holding the old password are rejected after this transaction commits.
        log.info("Account password updated: account id={}, method={}", user.getId(), action);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    notificationExecutor.execute(() -> {
                        try {
                            send(user.getEmail(), "Campus Connect - Your password changed",
                                    "Your Campus Connect password was changed. Existing logins using the old password no longer work. "
                                    + "If this was not you, reset your password through your account portal and contact campus support.");
                        } catch (RuntimeException ex) {
                            log.warn("Password change notification failed for account id={}", user.getId());
                        }
                    });
                } catch (RuntimeException ex) {
                    log.warn("Password change notification could not be queued for account id={}", user.getId());
                }
            }
        });
    }

    private void send(String recipient, String subject, String text) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(sender); message.setTo(recipient); message.setSubject(subject); message.setText(text);
        mail.send(message);
    }
}
