package com.campusconnect.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Service;

/** Check sender availability before looking up the requested account. */
@Service
public class OtpMailAvailability {
    private static final Logger log = LoggerFactory.getLogger(OtpMailAvailability.class);
    private final JavaMailSender mail;
    public OtpMailAvailability(JavaMailSender mail) { this.mail = mail; }

    public void ensureReady() {
        if (mail instanceof JavaMailSenderImpl smtp) {
            try {
                // Authenticate without sending a message, for all requested addresses alike.
                // This makes an SMTP outage an availability error rather than an account-existence signal.
                smtp.testConnection();
            } catch (Exception ex) {
                // Do not log mail message bodies, OTPs, passwords, or provider exception text.
                log.error("OTP sender connection/authentication failed ({}). Check spring.mail.username, "
                        + "spring.mail.password, SMTP host/port and TLS. For Gmail, use an App Password "
                        + "belonging to the configured sender account.", ex.getClass().getSimpleName());
                throw new IllegalStateException("Email service is temporarily unavailable.");
            }
        }
    }
}
