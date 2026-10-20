
package com.campusconnect.service;

import com.campusconnect.model.EmailOtp;
import com.campusconnect.model.User;
import com.campusconnect.repo.EmailOtpRepository;
import com.campusconnect.repo.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class EmailOtpService {

    private static final Logger log =
            LoggerFactory.getLogger(EmailOtpService.class);

    private static final SecureRandom RANDOM =
            new SecureRandom();

    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_SENDS_PER_HOUR = 5;

    private final EmailOtpRepository otpRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    @Value("${app.otp.expiry-minutes:5}")
    private long expiryMinutes;

    @Value("${app.allowed-email-domain:bmsce.ac.in}")
    private String allowedDomain;

    @Value("${spring.mail.username}")
    private String senderEmail;

    public EmailOtpService(
            EmailOtpRepository otpRepository,
            UserRepository userRepository,
            JavaMailSender mailSender,
            PasswordEncoder passwordEncoder,
            EntityManager entityManager
    ) {
        this.otpRepository = otpRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
        this.passwordEncoder = passwordEncoder;
        this.entityManager = entityManager;
    }

    // ======================================
    // NORMALIZE AND VALIDATE COLLEGE EMAIL
    // ======================================

    private String normalizeEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Email is required."
            );
        }

        String normalized = email.trim()
                .toLowerCase(Locale.ROOT);

        String domain = allowedDomain.trim()
                .toLowerCase(Locale.ROOT)
                .replaceFirst("^@", "");

        String pattern =
                "^[a-z0-9._%+-]+@" +
                Pattern.quote(domain) +
                "$";

        if (!normalized.matches(pattern)) {
            throw new IllegalArgumentException(
                    "Only @" + domain +
                    " email addresses are allowed."
            );
        }

        return normalized;
    }

    // ======================================
    // SEND EMAIL OTP
    // ======================================

    @Transactional
    public void sendOtp(String email) {

        String normalizedEmail = normalizeEmail(email);

        log.info("OTP request received");

        User user = userRepository
                .findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> {
                    log.warn(
                            "OTP request rejected: account not found"
                    );

                    return new IllegalArgumentException(
                            "Account not found. Please register first."
                    );
                });

        entityManager.lock(
                user,
                LockModeType.PESSIMISTIC_WRITE
        );

        if (user.isEmailVerified()) {
            log.info(
                    "OTP request skipped: account already verified"
            );

            throw new IllegalArgumentException(
                    "Email is already verified. Please sign in."
            );
        }

        Instant now = Instant.now();

        // Check requests made in the last hour
        List<EmailOtp> history = entityManager
                .createQuery(
                        "SELECT o FROM EmailOtp o " +
                        "WHERE LOWER(o.email) = :email " +
                        "AND o.createdAt >= :since " +
                        "ORDER BY o.createdAt DESC",
                        EmailOtp.class
                )
                .setParameter("email", normalizedEmail)
                .setParameter(
                        "since",
                        now.minus(Duration.ofHours(1))
                )
                .getResultList();

        if (history.size() >= MAX_SENDS_PER_HOUR) {
            log.warn(
                    "OTP request rejected: hourly limit reached"
            );

            throw new IllegalArgumentException(
                    "Too many OTP requests. Please try again after one hour."
            );
        }

        if (!history.isEmpty()) {

            EmailOtp latest = history.get(0);

            long secondsElapsed = Duration.between(
                    latest.getCreatedAt(),
                    now
            ).getSeconds();

            if (secondsElapsed < RESEND_COOLDOWN_SECONDS) {

                long waitSeconds =
                        RESEND_COOLDOWN_SECONDS - secondsElapsed;

                log.warn(
                        "OTP request rejected: resend cooldown active"
                );

                throw new IllegalArgumentException(
                        "Please wait " + waitSeconds +
                        " seconds before requesting another OTP."
                );
            }
        }

        // ======================================
        // GENERATE SECURE SIX-DIGIT OTP
        // ======================================

        String otp = String.format(
                Locale.ROOT,
                "%06d",
                RANDOM.nextInt(1_000_000)
        );

        log.info("OTP generated successfully");

        // ======================================
        // PREPARE EMAIL
        // ======================================

        SimpleMailMessage message =
                new SimpleMailMessage();

        message.setFrom(senderEmail);
        message.setTo(normalizedEmail);

        message.setSubject(
                "Campus Connect - Email Verification OTP"
        );

        message.setText(
                "Hello " + user.getName() + ",\n\n" +
                "Your Campus Connect verification code is:\n\n" +
                otp + "\n\n" +
                "This code expires in " +
                expiryMinutes + " minutes.\n\n" +
                "Do not share this code with anyone.\n\n" +
                "If you did not request this code, " +
                "you can ignore this email.\n\n" +
                "Campus Connect Team"
        );

        // ======================================
        // SEND EMAIL THROUGH SMTP
        // ======================================

        try {

            log.info(
                    "Attempting to send OTP email through SMTP"
            );

            mailSender.send(message);

            log.info(
                    "SMTP accepted the OTP email"
            );

        } catch (MailException ex) {

            log.error(
                    "SMTP failed while sending OTP email. " +
                    "Check SMTP host, port, credentials, " +
                    "TLS settings and recipient restrictions.",
                    ex
            );

            throw new IllegalStateException(
                    "Unable to send verification email right now.",
                    ex
            );
        }

        // ======================================
        // SAVE OTP HASH IN MYSQL
        // ======================================

        EmailOtp record = new EmailOtp();

        record.setEmail(normalizedEmail);

        // Never store the actual OTP
        record.setOtpHash(
                passwordEncoder.encode(otp)
        );

        record.setCreatedAt(now);

        record.setExpiresAt(
                now.plus(Duration.ofMinutes(expiryMinutes))
        );

        record.setAttempts(0);
        record.setUsed(false);

        try {

            otpRepository.saveAndFlush(record);

            log.info(
                    "OTP hash saved to database"
            );

        } catch (RuntimeException ex) {

            log.error(
                    "SMTP accepted OTP email, but database save failed",
                    ex
            );

            throw ex;
        }
    }

    // ======================================
    // VERIFY EMAIL OTP
    // ======================================

    @Transactional
    public boolean verifyOtp(String email, String otp) {

        String normalizedEmail = normalizeEmail(email);

        if (otp == null || !otp.matches("\\d{6}")) {
            throw new IllegalArgumentException(
                    "Enter a valid six-digit OTP."
            );
        }

        User user = userRepository
                .findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Invalid verification request."
                        )
                );

        entityManager.lock(
                user,
                LockModeType.PESSIMISTIC_WRITE
        );

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException(
                    "Email is already verified. Please sign in."
            );
        }

        EmailOtp record = otpRepository
                .findFirstByEmailIgnoreCaseOrderByCreatedAtDesc(
                        normalizedEmail
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "No OTP found. Request a new code."
                        )
                );

        if (record.isUsed()) {
            throw new IllegalArgumentException(
                    "This OTP has already been used."
            );
        }

        if (!Instant.now().isBefore(record.getExpiresAt())) {
            throw new IllegalArgumentException(
                    "OTP has expired. Request a new code."
            );
        }

        if (record.getAttempts() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException(
                    "Too many incorrect attempts. Request a new OTP."
            );
        }

        boolean valid = passwordEncoder.matches(
                otp,
                record.getOtpHash()
        );

        record.setAttempts(
                record.getAttempts() + 1
        );

        if (!valid) {

            otpRepository.save(record);

            log.warn(
                    "Incorrect OTP entered"
            );

            return false;
        }

        // ======================================
        // MARK OTP AS USED
        // ======================================

        record.setUsed(true);
        otpRepository.save(record);

        // ======================================
        // VERIFY USER ACCOUNT
        // ======================================

        user.setEmailVerified(true);
        user.setEmailVerifiedAt(Instant.now());

        userRepository.save(user);

        log.info(
                "College email verified successfully"
        );

        return true;
    }
}
