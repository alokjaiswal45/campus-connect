package com.campusconnect.api;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String domain;

    public AdminUserController(UserRepository users, PasswordEncoder encoder,
            @Value("${app.allowed-email-domain:bmsce.ac.in}") String domain) {
        this.users = users;
        this.encoder = encoder;
        this.domain = domain.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
    }

    public record CreateStaffRequest(String name, String email, String password, String role) {}
    public record UserView(Long id, String name, String email, String role,
                           boolean emailVerified, boolean accountActive) {
        static UserView from(User u) {
            return new UserView(u.getId(), u.getName(), u.getEmail(),
                    u.getRole(), u.isEmailVerified(), u.isAccountActive());
        }
    }

    @GetMapping
    public List<UserView> list() {
        return users.findAll().stream().map(UserView::from).toList();
    }

    @PostMapping("/staff")
    public ResponseEntity<?> createStaff(@RequestBody CreateStaffRequest request) {
        if (request == null || request.name() == null || request.name().isBlank()
                || request.email() == null || request.password() == null
                || request.password().length() < 12 || request.password().length() > 72
                || request.name().trim().length() > 100 || request.email().length() > 254
                || request.role() == null || !List.of("STAFF", "TEACHER").contains(request.role())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Name, college email, and password of at least 12 characters required");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!email.matches("^[a-z0-9._%+-]+@" + Pattern.quote(domain) + "$")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "A valid BMSCE email is required");
        }
        if (users.findByEmailIgnoreCase(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Email already registered"));
        }
        User staff = new User(request.name().trim(), email,
                encoder.encode(request.password()), request.role());
        // Provisioned accounts are created by authorized administrators.
        staff.setEmailVerified(true);
        staff.setEmailVerifiedAt(Instant.now());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(UserView.from(users.save(staff)));
    }

    public record StudentAccessRequest(Boolean active) {}

    @PutMapping("/{id}/student-access")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<UserView> studentAccess(@PathVariable Long id, @RequestBody StudentAccessRequest request) {
        if (request == null || request.active() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specify active true or false");
        }
        User student = users.lockById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Student not found"));
        if (!"STUDENT".equals(student.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only student account access can be updated here");
        }
        // Does not modify passwords, email addresses, roles or email-verification state.
        student.setAccountActive(request.active());
        org.slf4j.LoggerFactory.getLogger(AdminUserController.class).info("Student account access changed: id={}, active={}", id, request.active());
        return ResponseEntity.ok(UserView.from(users.save(student)));
    }

    @PutMapping("/{id}/terminate")
    public ResponseEntity<UserView> terminate(@PathVariable Long id) {
        User employee = users.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        if (!List.of("STAFF", "TEACHER").contains(employee.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only employee accounts can be terminated");
        }
        // Preserve ownership, audit history, and uploaded records while denying future logins.
        employee.setAccountActive(false);
        employee.setEmailVerified(false);
        employee.setEmailVerifiedAt(null);
        return ResponseEntity.ok(UserView.from(users.save(employee)));
    }
}
