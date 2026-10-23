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
    private final java.util.function.LongSupplier clock;
    private long nextCheck = Long.MIN_VALUE;
    private boolean ready;

    @org.springframework.beans.factory.annotation.Autowired
    public OtpMailAvailability(JavaMailSender mail) { this(mail, System::nanoTime); }
    OtpMailAvailability(JavaMailSender mail, java.util.function.LongSupplier clock) {
        this.mail = mail; this.clock = clock;
    }

    public synchronized void ensureReady() {
        long now = clock.getAsLong();
        if (now < nextCheck) {
            if (ready) return;
            throw new IllegalStateException("Email service is temporarily unavailable.");
        }
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
                ready = false;
                nextCheck = clock.getAsLong() + java.util.concurrent.TimeUnit.SECONDS.toNanos(5);
                throw new IllegalStateException("Email service is temporarily unavailable.");
            }
        }
        ready = true;
        nextCheck = clock.getAsLong() + java.util.concurrent.TimeUnit.SECONDS.toNanos(60);
    }
}
