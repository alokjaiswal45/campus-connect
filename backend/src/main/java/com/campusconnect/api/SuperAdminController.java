package com.campusconnect.api;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/super-admin")
public class SuperAdminController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String domain;

    public SuperAdminController(UserRepository users, PasswordEncoder encoder,
            @Value("${app.allowed-email-domain:bmsce.ac.in}") String domain) {
        this.users = users;
        this.encoder = encoder;
        this.domain = domain.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
    }

    public record CreateAdmin(String name, String email, String password) {}
    public record Account(Long id, String name, String email, String role) {
        static Account from(User user) {
            return new Account(user.getId(), user.getName(), user.getEmail(), user.getRole());
        }
    }

    @GetMapping("/admins")
    public List<Account> admins() {
        return users.findAll().stream()
                .filter(u -> "ADMIN".equals(u.getRole()))
                .map(Account::from).toList();
    }

    @PostMapping("/admins")
    public ResponseEntity<Account> createAdmin(@RequestBody CreateAdmin request) {
        if (request == null || request.name() == null || request.name().isBlank()
                || request.email() == null || request.password() == null
                || request.password().length() < 12) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Name, college email and password of at least 12 characters required");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!email.matches("^[a-z0-9._%+-]+@" + Pattern.quote(domain) + "$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid college email");
        }
        if (users.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }
        User admin = new User(request.name().trim(), email,
                encoder.encode(request.password()), "ADMIN");
        admin.setEmailVerified(true);
        admin.setEmailVerifiedAt(Instant.now());
        return ResponseEntity.status(HttpStatus.CREATED).body(Account.from(users.save(admin)));
    }

    @DeleteMapping("/admins/{id}")
    public ResponseEntity<Void> revokeAdmin(@PathVariable Long id, Authentication auth) {
        User user = users.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        if (!"ADMIN".equals(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not an admin account");
        }
        // Preserve audit records but disable authentication; do not grant student access.
        user.setRole("STUDENT");
        user.setEmailVerified(false);
        user.setEmailVerifiedAt(null);
        users.save(user);
        return ResponseEntity.noContent().build();
    }
}
