package com.campusconnect.api;

import com.campusconnect.service.StudentPasswordService;
import com.campusconnect.service.OtpMailAvailability;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class StudentPasswordController {
    private static final Logger log = LoggerFactory.getLogger(StudentPasswordController.class);
    private final StudentPasswordService passwords;
    private final OtpMailAvailability mailAvailability;
    public StudentPasswordController(StudentPasswordService passwords, OtpMailAvailability mailAvailability) {
        this.passwords = passwords; this.mailAvailability = mailAvailability;
    }
    public record RequestReset(String email) {}
    public record Reset(String email, String otp, String newPassword) {}
    public record Change(String currentPassword, String newPassword) {}

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> request(@RequestBody RequestReset request) {
        long started = System.nanoTime();
        try {
            mailAvailability.ensureReady();
            passwords.requestReset(request == null ? null : request.email());
        } catch (RuntimeException ex) {
            log.warn("Password reset request could not be processed ({})", ex.getClass().getSimpleName());
            return ResponseEntity.status(503).body(Map.of("error",
                    "Email service is temporarily unavailable. Please try again later."));
        } finally {
            log.info("Password reset code request completed in {} ms", java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        }
        return ResponseEntity.ok(Map.of("message", "If this is an active, verified account, a reset code will be sent to its registered email. Wait at least 60 seconds before requesting another code."));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> reset(@RequestBody Reset request) {
        if (request == null || !StudentPasswordService.validPassword(request.newPassword())) return invalidPassword();
        long started = System.nanoTime();
        boolean updated = passwords.reset(request.email(), request.otp(), request.newPassword());
        log.info("Password reset verification completed in {} ms", java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        if (!updated) {
            return ResponseEntity.badRequest().body(Map.of("error", "Reset failed. Check the code, use a different password, or request a new code if it expired."));
        }
        return success();
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> change(@RequestBody Change request, Authentication auth) {
        // Defense in depth: caller identity always comes from authentication, never a supplied student id/email.
        if (auth == null || auth.getAuthorities().stream().noneMatch(a -> "ROLE_STUDENT".equals(a.getAuthority()))) {
            return ResponseEntity.status(403).body(Map.of("error", "Student account required"));
        }
        if (request == null || !StudentPasswordService.validPassword(request.newPassword())) return invalidPassword();
        if (!passwords.change(auth.getName(), request.currentPassword(), request.newPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Check your current password and choose a different new password."));
        }
        return success();
    }
    private ResponseEntity<?> invalidPassword() {
        return ResponseEntity.badRequest().body(Map.of("error", "Use at least 8 characters and no more than 72 UTF-8 bytes."));
    }
    private ResponseEntity<?> success() {
        return ResponseEntity.ok(Map.of("message", "Password updated. Sign in again with your new password."));
    }
}
