package com.campusconnect.service;

import com.campusconnect.model.*;
import com.campusconnect.repo.*;
import java.time.Instant;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = "spring.jpa.show-sql=false", showSql = false)
@Import({StudentPasswordService.class, StudentPasswordTransactionTest.Crypto.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StudentPasswordTransactionTest {
    @TestConfiguration static class Crypto {
        @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(4); }
        @Bean(name = "passwordMailExecutor") java.util.concurrent.Executor notificationExecutor() { return Runnable::run; }
    }
    @Autowired StudentPasswordService service;
    @Autowired UserRepository users;
    @Autowired PasswordResetRepository resets;
    @Autowired PasswordEncoder encoder;
    @MockitoBean JavaMailSender mail;
    final String email = "student@bmsce.ac.in";
    @BeforeEach void setup() {
        resets.deleteAll(); users.deleteAll();
        User student = new User("Student", email, encoder.encode("old-password"), "STUDENT");
        student.setEmailVerified(true); users.saveAndFlush(student);
    }
    private PasswordReset code(String code) {
        PasswordReset reset = new PasswordReset(); reset.email = email; reset.codeHash = encoder.encode(code);
        reset.createdAt = Instant.now().minusSeconds(120); reset.expiresAt = Instant.now().plusSeconds(300);
        return resets.saveAndFlush(reset);
    }
    @Test void wrongAttemptsCommitAndLockOutEvenCorrectSixthCode() {
        code("123456");
        for (int i = 0; i < 5; i++) assertFalse(service.reset(email, "999999", "new-password"));
        assertEquals(5, resets.findFirstByEmailOrderByCreatedAtDescIdDesc(email).orElseThrow().attempts);
        assertFalse(service.reset(email, "123456", "new-password"));
        assertTrue(encoder.matches("old-password", users.findByEmailIgnoreCase(email).orElseThrow().getPassword()));
    }
    @Test void successfulResetIsSingleUseAndInvalidatesOtherCodes() {
        code("654321"); code("123456");
        assertTrue(service.reset(email, "123456", "new-password"));
        assertTrue(resets.findAll().stream().allMatch(r -> r.used));
        assertFalse(service.reset(email, "123456", "another-password"));
        assertTrue(encoder.matches("new-password", users.findByEmailIgnoreCase(email).orElseThrow().getPassword()));
        verify(mail).send(any(SimpleMailMessage.class));
    }
    @Test void concurrentCodeReuseOnlyChangesPasswordOnce() throws Exception {
        code("123456");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch start = new CountDownLatch(1);
            Future<Boolean> first = executor.submit(() -> { start.await(); return service.reset(email, "123456", "first-password"); });
            Future<Boolean> second = executor.submit(() -> { start.await(); return service.reset(email, "123456", "second-password"); });
            start.countDown();
            assertNotEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        } finally { executor.shutdownNow(); }
    }
    @Test void passwordChangeInvalidatesPendingResetCodes() {
        code("123456");
        assertTrue(service.change(email, "old-password", "new-password"));
        assertFalse(service.reset(email, "123456", "another-password"));
        assertTrue(resets.findAll().get(0).used);
    }
    @Test void failedCodeDeliveryRollsBackInvalidationOfOlderCode() {
        code("123456");
        doThrow(new MailSendException("test failure")).when(mail).send(any(SimpleMailMessage.class));
        assertThrows(MailSendException.class, () -> service.requestReset(email));
        assertEquals(1, resets.count());
        assertFalse(resets.findAll().get(0).used);
    }
}
