package com.campusconnect.api;

import com.campusconnect.repo.UserRepository;
import com.campusconnect.service.EmailOtpService;
import com.campusconnect.util.EmailValidator;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthControllerTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final EmailOtpService otp = mock(EmailOtpService.class);
    private final AuthController controller = new AuthController(
            users, encoder, otp, mock(EmailValidator.class), "bmsce.ac.in");

    @Test
    void registrationRejectsOversizedNameBeforeHashing() {
        var result = controller.register(new AuthController.Register(
                "A".repeat(101), "student@bmsce.ac.in", "password123"));
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void registrationRejectsOversizedPasswordBeforeHashing() {
        var result = controller.register(new AuthController.Register(
                "Student", "student@bmsce.ac.in", "p".repeat(73)));
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void registrationRejectsOversizedUtf8Password() {
        var result = controller.register(new AuthController.Register(
                "Student", "student@bmsce.ac.in", "界".repeat(25)));
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void registrationRejectsShortPassword() {
        var result = controller.register(new AuthController.Register(
                "Student", "student@bmsce.ac.in", "short"));
        assertEquals(HttpStatus.BAD_REQUEST, result.getStatusCode());
        verifyNoInteractions(users, encoder);
    }
}
