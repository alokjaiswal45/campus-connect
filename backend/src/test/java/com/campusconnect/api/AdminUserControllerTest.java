package com.campusconnect.api;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminUserControllerTest {
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final AdminUserController controller =
            new AdminUserController(users, encoder, "bmsce.ac.in");

    @Test
    void rejectsUnauthorizedEmployeeRole() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                controller.createStaff(new AdminUserController.CreateStaffRequest(
                        "Test", "test@bmsce.ac.in", "strong-password-123", "ADMIN")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        verifyNoInteractions(users, encoder);
    }

    @Test
    void rejectsShortEmployeePassword() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                controller.createStaff(new AdminUserController.CreateStaffRequest(
                        "Test", "test@bmsce.ac.in", "short", "TEACHER")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void cannotTerminateAdministrator() {
        User admin = new User("Admin", "admin@bmsce.ac.in", "hashed", "ADMIN");
        when(users.findById(1L)).thenReturn(Optional.of(admin));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                controller.terminate(1L));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        verify(users, never()).save(any());
    }

    @Test
    void terminatedTeacherCannotAuthenticate() {
        User teacher = new User("Teacher", "teacher@bmsce.ac.in", "hashed", "TEACHER");
        teacher.setEmailVerified(true);
        when(users.findById(2L)).thenReturn(Optional.of(teacher));
        when(users.save(teacher)).thenReturn(teacher);
        controller.terminate(2L);
        assertFalse(teacher.isEmailVerified());
        assertFalse(teacher.isAccountActive());
        assertNull(teacher.getEmailVerifiedAt());
    }
}
