
package com.campusconnect.api;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import com.campusconnect.service.EmailOtpService;
import com.campusconnect.service.OtpMailAvailability;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.campusconnect.util.EmailValidator;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger log =
            LoggerFactory.getLogger(AuthController.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final EmailOtpService otpService;
    private final OtpMailAvailability mailAvailability;
    private final String allowedDomain;
private final EmailValidator emailValidator;

    public AuthController(
            UserRepository users,
            PasswordEncoder encoder,
            EmailOtpService otpService,
            OtpMailAvailability mailAvailability,
            EmailValidator emailValidator,
            @Value("${app.allowed-email-domain:bmsce.ac.in}")
            String allowedDomain
    ) {
        this.users = users;
        this.encoder = encoder;
        this.otpService = otpService;
        this.mailAvailability = mailAvailability;
        this.emailValidator = emailValidator;
        this.allowedDomain = allowedDomain.trim()
                .toLowerCase(Locale.ROOT)
                .replaceFirst("^@", "");
    }

    // ======================================
    // REQUEST OBJECTS
    // ======================================

    public record Register(
            String name,
            String email,
            String password
    ) {}

    public record SendOtpRequest(String email) {}

    public record VerifyOtpRequest(
            String email,
            String otp
    ) {}

    // ======================================
    // REGISTER STUDENT
    // ======================================

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @RequestBody Register request
    ) {

        if (request == null ||
                request.name() == null ||
                request.name().isBlank() ||
                request.name().trim().length() > 100 ||
                request.email() == null ||
                request.email().length() > 254 ||
                request.password() == null ||
                request.password().length() < 8 ||
                request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "error",
                            "Enter a name (up to 100 characters), college email and password (8-72 characters)"
                    )
            );
        }

        String email = normalizeEmail(request.email());

        if (!isCollegeEmail(email)) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "error",
                            "Only @" + allowedDomain +
                            " college email addresses are allowed"
                    )
            );
        }

        if (users.findByEmailIgnoreCase(email).isPresent()) {
            return ResponseEntity.status(
                    HttpStatus.CONFLICT
            ).body(
                    Map.of(
                            "error",
                            "Email already registered"
                    )
            );
        }

        User user = new User(
                request.name().trim(),
                email,
                encoder.encode(request.password()),
                "STUDENT"
        );

        user.setEmailVerified(false);
        user.setEmailVerifiedAt(null);

        User savedUser = users.save(user);

        return ResponseEntity.status(
                HttpStatus.CREATED
        ).body(
                Map.of(
                        "id", savedUser.getId(),
                        "name", savedUser.getName(),
                        "email", savedUser.getEmail(),
                        "role", savedUser.getRole(),
                        "emailVerified", false,
                        "message",
                        "Registration successful. Request an OTP to verify your college email."
                )
        );
    }

    // ======================================
    // SEND EMAIL OTP
    // ======================================

    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(
            @RequestBody SendOtpRequest request
    ) {

        if (request == null ||
                !isCollegeEmail(request.email())) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "error",
                            "Enter a valid @" + allowedDomain +
                            " email address"
                    )
            );
        }

        String email = normalizeEmail(request.email());

        try {
            mailAvailability.ensureReady();
            otpService.sendOtp(email);

            log.info("OTP request processed");

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "If this account requires verification, an OTP will be sent to its college email."
                    )
            );

        } catch (IllegalArgumentException ex) {

            // Preserve generic responses to avoid
            // revealing whether an account exists.
            log.warn("OTP request rejected: {}",
                    ex.getMessage());

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "If this account requires verification, an OTP will be sent to its college email."
                    )
            );

        } catch (Exception ex) {

            log.error("OTP delivery or processing failed", ex);

            return ResponseEntity.status(
                    HttpStatus.SERVICE_UNAVAILABLE
            ).body(
                    Map.of(
                            "error",
                            "Unable to send verification email right now. Please try again later."
                    )
            );
        }
    }

    // ======================================
    // VERIFY EMAIL OTP
    // ======================================

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(
            @RequestBody VerifyOtpRequest request
    ) {

        if (request == null ||
                !isCollegeEmail(request.email()) ||
                request.otp() == null ||
                !request.otp().matches("\\d{6}")) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "error",
                            "Enter a valid college email and six-digit OTP"
                    )
            );
        }

        try {

            boolean verified = otpService.verifyOtp(
                    normalizeEmail(request.email()),
                    request.otp()
            );

            if (!verified) {
                return ResponseEntity.badRequest().body(
                        Map.of(
                                "error",
                                "Incorrect OTP. Please try again."
                        )
                );
            }

            return ResponseEntity.ok(
                    Map.of(
                            "message",
                            "Email verified successfully. You can now log in."
                    )
            );

        } catch (IllegalArgumentException ex) {

            log.warn("OTP verification rejected: {}",
                    ex.getMessage());

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "error",
                            "OTP is invalid, expired, or no longer usable. Please request a new code if needed."
                    )
            );
        }
    }

    // ======================================
    // CURRENT LOGGED-IN USER
    // ======================================

    @GetMapping("/me")
    public ResponseEntity<?> me(
            Authentication authentication
    ) {

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            return ResponseEntity.status(
                    HttpStatus.UNAUTHORIZED
            ).body(
                    Map.of(
                            "error",
                            "Please log in first"
                    )
            );
        }

        User user = users
                .findByEmailIgnoreCase(
                        authentication.getName()
                )
                .orElse(null);

        if (user == null) {
            return ResponseEntity.status(
                    HttpStatus.UNAUTHORIZED
            ).body(
                    Map.of(
                            "error",
                            "User not found"
                    )
            );
        }

        if (!isCollegeEmail(user.getEmail())) {
            return ResponseEntity.status(
                    HttpStatus.FORBIDDEN
            ).body(
                    Map.of(
                            "error",
                            "Only @" + allowedDomain +
                            " college accounts are allowed"
                    )
            );
        }

        if (!user.isEmailVerified()) {
            return ResponseEntity.status(
                    HttpStatus.FORBIDDEN
            ).body(
                    Map.of(
                            "error",
                            "Please verify your college email before logging in"
                    )
            );
        }

        return ResponseEntity.ok(
                Map.of(
                        "id", user.getId(),
                        "name", user.getName(),
                        "email", user.getEmail(),
                        "role", user.getRole(),
                        "emailVerified", true
                )
        );
    }

    // ======================================
    // EMAIL VALIDATION
    // ======================================

    private String normalizeEmail(String email) {
        return email == null ? "" :
                email.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isCollegeEmail(String email) {

        String normalized = normalizeEmail(email);

        if (normalized.isBlank() ||
                allowedDomain.isBlank()) {
            return false;
        }

        int atIndex = normalized.indexOf('@');

        if (atIndex <= 0 ||
                atIndex != normalized.lastIndexOf('@')) {
            return false;
        }

        String localPart =
                normalized.substring(0, atIndex);

        String domain =
                normalized.substring(atIndex + 1);

        return localPart.matches("[a-z0-9._%+-]+")
                && domain.equals(allowedDomain);
    }
}
