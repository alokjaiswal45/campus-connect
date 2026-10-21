package com.campusconnect.config;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.time.Instant;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class SeedAdmin {
    @Bean
    CommandLineRunner seed(
            UserRepository repo,
            PasswordEncoder encoder,
            @Value("${app.admin.email}") String email,
            @Value("${app.admin.password}") String password) {
        return args -> {
            String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
            if (repo.findByEmailIgnoreCase(normalizedEmail).isEmpty()) {
                User admin = new User("Administrator", normalizedEmail,
                        encoder.encode(password), "ADMIN");
                // Bootstrap administrators are provisioned by server configuration,
                // not by public student registration.
                admin.setEmailVerified(true);
                admin.setEmailVerifiedAt(Instant.now());
                repo.save(admin);
            }
        };
    }
}
