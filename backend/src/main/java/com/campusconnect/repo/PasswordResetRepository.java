package com.campusconnect.repo;

import com.campusconnect.model.PasswordReset;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, Long> {
    Optional<PasswordReset> findFirstByEmailOrderByCreatedAtDescIdDesc(String email);
    long countByEmailAndCreatedAtAfter(String email, Instant since);
    @Modifying
    @Query("update PasswordReset r set r.used = true where r.email = :email and r.used = false")
    void invalidateAll(@Param("email") String email);
}
