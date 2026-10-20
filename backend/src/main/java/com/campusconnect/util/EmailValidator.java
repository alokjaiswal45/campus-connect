package com.campusconnect.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Centralised e‑mail validation used by both the controller and the OTP service.
 * The allowed domain is injected from {@code app.allowed-email-domain}
 * (default: bmsce.ac.in). This component ensures a single source of truth
 * for domain checks throughout the application.
 */
@Component
public class EmailValidator {

    @Value("${app.allowed-email-domain:bmsce.ac.in}")
    private String allowedDomain;

    /**
     * Returns {@code true} iff the e‑mail matches the configured domain.
     */
    public boolean isCollegeEmail(String email) {
        if (email == null) {
            return false;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        String pattern = "^[a-z0-9._%+-]+@" + Pattern.quote(allowedDomain.toLowerCase(Locale.ROOT)) + "$";
        return normalized.matches(pattern);
    }
}
