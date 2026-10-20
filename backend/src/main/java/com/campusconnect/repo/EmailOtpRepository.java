
package com.campusconnect.repo;

import com.campusconnect.model.EmailOtp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailOtpRepository
        extends JpaRepository<EmailOtp, Long> {

    // Find the most recently generated OTP for an email.
    Optional<EmailOtp> findFirstByEmailIgnoreCaseOrderByCreatedAtDesc(
            String email
    );

}
