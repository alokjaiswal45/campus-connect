package com.campusconnect.api;

import com.campusconnect.service.StudentPasswordService;
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
    public StudentPasswordController(StudentPasswordService passwords) { this.passwords = passwords; }
    public record RequestReset(String email) {}
    public record Reset(String email, String otp, String newPassword) {}
    public record Change(String currentPassword, String newPassword) {}

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> request(@RequestBody RequestReset request) {
        try { passwords.requestReset(request == null ? null : request.email()); }
        catch (RuntimeException ex) { log.warn("Password reset request could not be processed"); }
        return ResponseEntity.ok(Map.of("message", "If this is an active, verified student account, a reset code will be sent to its registered college email. Wait at least 60 seconds before requesting another code."));
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> reset(@RequestBody Reset request) {
        if (request == null || !StudentPasswordService.validPassword(request.newPassword())) return invalidPassword();
        if (!passwords.reset(request.email(), request.otp(), request.newPassword())) {
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
