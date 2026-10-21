
package com.campusconnect.config;

import com.campusconnect.repo.UserRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;

import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Configuration
public class SecurityConfig {

    // ======================================
    // CONFIGURABLE COLLEGE EMAIL DOMAIN
    // ======================================

    @Value("${app.allowed-email-domain:bmsce.ac.in}")
    private String allowedEmailDomain;

    // ======================================
    // PASSWORD ENCODER
    // ======================================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // ======================================
    // USER AUTHENTICATION
    // ======================================

    @Bean
    public UserDetailsService userDetailsService(
            UserRepository repo
    ) {
        return username -> {

            if (username == null || username.isBlank()) {
                throw new UsernameNotFoundException(
                        "Invalid credentials"
                );
            }

            String email = username.trim()
                    .toLowerCase(Locale.ROOT);

            String domain = allowedEmailDomain.trim()
                    .toLowerCase(Locale.ROOT)
                    .replaceFirst("^@", "");

            String emailPattern =
                    "^[a-z0-9._%+-]+@" +
                    Pattern.quote(domain) +
                    "$";

            if (!email.matches(emailPattern)) {
                throw new UsernameNotFoundException(
                        "Invalid credentials"
                );
            }

            var account = repo
                    .findByEmailIgnoreCase(email)
                    .orElseThrow(() ->
                            new UsernameNotFoundException(
                                    "Invalid credentials"
                            )
                    );

            // Only verified accounts can authenticate.
            if (!account.isEmailVerified()) {
                throw new UsernameNotFoundException(
                        "Invalid credentials"
                );
            }

            return User.withUsername(account.getEmail())
                    .password(account.getPassword())
                    .roles(account.getRole())
                    .build();
        };
    }

    // ======================================
    // SPRING SECURITY FILTER CHAIN
    // ======================================

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http
    ) throws Exception {

        return http

                // Stateless HTTP Basic API.
                .csrf(csrf -> csrf.disable())

                // Enable configured CORS rules.
                .cors(Customizer.withDefaults())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(
                                SessionCreationPolicy.STATELESS
                        )
                )

                .authorizeHttpRequests(auth -> auth

                        // Public root and error endpoints.
                        .requestMatchers("/", "/error")
                        .permitAll()

                        // Browser CORS preflight requests.
                        .requestMatchers(
                                HttpMethod.OPTIONS,
                                "/**"
                        )
                        .permitAll()

                        // Registration and OTP endpoints.
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/auth/register",
                                "/api/auth/send-otp",
                                "/api/auth/verify-otp"
                        )
                        .permitAll()

                        // Public health endpoint.
                        .requestMatchers(
                                "/api/health"
                        )
                        .permitAll()

                        // ======================================
                        // ADMIN ENDPOINTS
                        // ======================================

                        .requestMatchers("/api/admin/**")
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Create branches.
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/branches",
                                "/api/branches/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Delete branches.
                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/branches",
                                "/api/branches/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Create subjects.
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/subjects",
                                "/api/subjects/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Delete subjects.
                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/subjects",
                                "/api/subjects/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Upload academic documents.
                        .requestMatchers(
                                HttpMethod.POST,
                                "/api/documents",
                                "/api/documents/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Delete academic documents.
                        .requestMatchers(
                                HttpMethod.DELETE,
                                "/api/documents",
                                "/api/documents/**"
                        )
                        .hasAnyRole("ADMIN", "SUPER_ADMIN")

                        // Super-admin-only account governance.
                        .requestMatchers("/api/super-admin/**")
                        .hasRole("SUPER_ADMIN")

                        // Ownership claims and appeals are reserved for student accounts.
                        .requestMatchers(HttpMethod.POST, "/api/items/*/claims",
                                "/api/claims/*/disputes", "/api/claims/*/evidence")
                        .hasRole("STUDENT")

                        // Lost-and-found desk operations.
                        .requestMatchers("/api/staff/**")
                        .hasAnyRole("STAFF", "ADMIN", "SUPER_ADMIN")

                        // Student-only endpoints (future student controllers).
                        .requestMatchers("/api/student/**")
                        .hasRole("STUDENT")

                        // ======================================
                        // AUTHENTICATED USER ENDPOINTS
                        // ======================================

                        .requestMatchers("/api/**")
                        .authenticated()

                        .anyRequest()
                        .authenticated()
                )

                // HTTP Basic authentication.
                .httpBasic(Customizer.withDefaults())

                .build();
    }

    // ======================================
    // ANGULAR CORS CONFIGURATION
    // ======================================

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration config =
                new CorsConfiguration();

        // Only these Angular origins are allowed
        // to read cross-origin API responses.
        config.setAllowedOrigins(
                List.of(
                        "http://localhost:4200",
                        "http://localhost:4201"
                )
        );

        config.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"
                )
        );

        config.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type"
                )
        );

        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration(
                "/**",
                config
        );

        return source;
    }
}
