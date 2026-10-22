package com.campusconnect.service;

import com.campusconnect.model.*;
import com.campusconnect.repo.*;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudentPasswordServiceTest {
    UserRepository users = mock(UserRepository.class);
    PasswordResetRepository resets = mock(PasswordResetRepository.class);
    JavaMailSender mail = mock(JavaMailSender.class);
    BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    StudentPasswordService service = new StudentPasswordService(users, resets, encoder, mail, "sender@example.test", "bmsce.ac.in");
    User student;
    PasswordReset reset;

    @BeforeEach void setup() {
        student = new User("Student", "student@bmsce.ac.in", encoder.encode("old-password"), "STUDENT");
        student.setId(1L); student.setEmailVerified(true);
        when(users.lockByEmail(student.getEmail())).thenReturn(Optional.of(student));
        reset = new PasswordReset(); reset.email = student.getEmail(); reset.createdAt = Instant.now().minusSeconds(120);
        reset.expiresAt = Instant.now().plusSeconds(300); reset.codeHash = encoder.encode("123456");
        when(resets.findFirstByEmailOrderByCreatedAtDescIdDesc(student.getEmail())).thenReturn(Optional.of(reset));
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void cleanup() { TransactionSynchronizationManager.clearSynchronization(); }

    @Test void onlyHashedCodeIsStoredAndSentToRegisteredCollegeEmail() {
        service.requestReset(" Student@BMSCE.ac.in ");
        var record = ArgumentCaptor.forClass(PasswordReset.class);
        verify(resets).saveAndFlush(record.capture());
        var message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail).send(message.capture());
        assertEquals(student.getEmail(), message.getValue().getTo()[0]);
        String code = java.util.regex.Pattern.compile("code is: ([0-9]{6})").matcher(message.getValue().getText()).results().findFirst().orElseThrow().group(1);
        assertNotEquals(code, record.getValue().codeHash);
        assertTrue(encoder.matches(code, record.getValue().codeHash));
        assertEquals(300, java.time.Duration.between(record.getValue().createdAt, record.getValue().expiresAt).getSeconds());
        verify(resets).invalidateAll(student.getEmail());
    }
    @Test void resendCooldownAndHourlyLimitPreventExtraEmails() {
        reset.createdAt = Instant.now(); service.requestReset(student.getEmail());
        verifyNoInteractions(mail);
        reset.createdAt = Instant.now().minusSeconds(120);
        when(resets.countByEmailAndCreatedAtAfter(eq(student.getEmail()), any())).thenReturn(5L);
        service.requestReset(student.getEmail()); verifyNoInteractions(mail);
    }
    @Test void missingUnverifiedInactiveAndNonStudentAccountsReceiveNoCode() {
        service.requestReset("missing@bmsce.ac.in");
        student.setEmailVerified(false); service.requestReset(student.getEmail());
        student.setEmailVerified(true); student.setAccountActive(false); service.requestReset(student.getEmail());
        student.setAccountActive(true); student.setRole("ADMIN"); service.requestReset(student.getEmail());
        verifyNoInteractions(mail); verify(resets, never()).saveAndFlush(any());
    }
    @Test void incorrectCodeConsumesAttemptWithoutChangingPassword() {
        String old = student.getPassword();
        assertFalse(service.reset(student.getEmail(), "999999", "new-password"));
        assertEquals(1, reset.attempts); assertEquals(old, student.getPassword());
        verify(resets).save(reset); verify(users, never()).saveAndFlush(any());
    }
    @Test void exhaustedExpiredAndUsedCodesCannotReset() {
        reset.attempts = 5; assertFalse(service.reset(student.getEmail(), "123456", "new-password"));
        reset.attempts = 0; reset.expiresAt = Instant.now().minusSeconds(1);
        assertFalse(service.reset(student.getEmail(), "123456", "new-password"));
        reset.expiresAt = Instant.now().plusSeconds(60); reset.used = true;
        assertFalse(service.reset(student.getEmail(), "123456", "new-password"));
        verify(users, never()).saveAndFlush(any());
    }
    @Test void resetReplacesHashInvalidatesCodesAndNotifiesOnlyAfterCommit() {
        assertTrue(service.reset(student.getEmail(), "123456", "new-password"));
        assertFalse(encoder.matches("old-password", student.getPassword()));
        assertTrue(encoder.matches("new-password", student.getPassword()));
        verify(resets).invalidateAll(student.getEmail()); verifyNoInteractions(mail);
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());
        verify(mail).send(any(SimpleMailMessage.class));
    }
    @Test void changeRequiresCurrentPasswordAndRejectsReusingIt() {
        assertFalse(service.change(student.getEmail(), "incorrect", "new-password"));
        assertFalse(service.change(student.getEmail(), "old-password", "old-password"));
        assertTrue(service.change(student.getEmail(), "old-password", "new-password"));
        assertTrue(encoder.matches("new-password", student.getPassword()));
    }
    @Test void oversizedUtf8PasswordIsRejectedBeforeHashing() {
        assertFalse(StudentPasswordService.validPassword("界".repeat(25)));
        assertFalse(service.change(student.getEmail(), "old-password", "界".repeat(25)));
        verify(users, never()).saveAndFlush(any());
    }
    @Test void notificationFailureDoesNotUndoPasswordChange() {
        assertTrue(service.change(student.getEmail(), "old-password", "new-password"));
        doThrow(new MailSendException("unavailable")).when(mail).send(any(SimpleMailMessage.class));
        assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit()));
        assertTrue(encoder.matches("new-password", student.getPassword()));
    }
}
