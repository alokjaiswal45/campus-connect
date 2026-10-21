package com.campusconnect.api;

import com.campusconnect.repo.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SuperAdminControllerTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final SuperAdminController controller =
            new SuperAdminController(users, encoder, "bmsce.ac.in");

    @Test
    void rejectsOversizedAdminNameBeforeHashing() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.createAdmin(new SuperAdminController.CreateAdmin(
                        "X".repeat(101), "admin@bmsce.ac.in", "strong-password-123")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void rejectsOversizedAdminPasswordBeforeHashing() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.createAdmin(new SuperAdminController.CreateAdmin(
                        "Administrator", "admin@bmsce.ac.in", "X".repeat(73))));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void rejectsNonCollegeAdminEmail() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class, () ->
                controller.createAdmin(new SuperAdminController.CreateAdmin(
                        "Administrator", "admin@external.com", "strong-password-123")));
        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verifyNoInteractions(users, encoder);
    }
}
