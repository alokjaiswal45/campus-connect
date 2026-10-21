package com.campusconnect.config;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SeedSuperAdmin {
    @Bean
    CommandLineRunner seedSuperAdmin(UserRepository users, PasswordEncoder encoder,
            @Value("${app.super-admin.email:}") String configuredEmail,
            @Value("${app.super-admin.password:}") String configuredPassword,
            @Value("${app.allowed-email-domain:bmsce.ac.in}") String configuredDomain) {
        return args -> {
            // Opt-in bootstrap only: both values must be explicitly configured.
            if (configuredEmail.isBlank() && configuredPassword.isBlank()) return;
            String email = configuredEmail.trim().toLowerCase(Locale.ROOT);
            String domain = configuredDomain.trim().toLowerCase(Locale.ROOT).replaceFirst("^@", "");
            if (!email.matches("^[a-z0-9._%+-]+@" + Pattern.quote(domain) + "$")
                    || configuredPassword.length() < 12) {
                throw new IllegalStateException("Invalid super-admin bootstrap configuration");
            }
            // Never elevate an existing account based only on an environment setting.
            if (users.findByEmailIgnoreCase(email).isPresent()) return;
            User superAdmin = new User("Super Administrator", email,
                    encoder.encode(configuredPassword), "SUPER_ADMIN");
            superAdmin.setEmailVerified(true);
            superAdmin.setEmailVerifiedAt(Instant.now());
            users.save(superAdmin);
        };
    }
}
