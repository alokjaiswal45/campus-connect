package com.campusconnect.api;

import com.campusconnect.config.SecurityConfig;
import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import com.campusconnect.service.StudentPasswordService;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StudentPasswordController.class)
@Import(SecurityConfig.class)
class StudentPasswordSecurityTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockitoBean UserRepository users;
    @MockitoBean StudentPasswordService passwords;
    User student;
    private String basic(String email, String password) {
        return "Basic " + Base64.getEncoder().encodeToString((email + ":" + password).getBytes(StandardCharsets.UTF_8));
    }
    @BeforeEach void setup() {
        student = new User("Student", "student@bmsce.ac.in", encoder.encode("old-password"), "STUDENT");
        student.setEmailVerified(true);
        when(users.findByEmailIgnoreCase(student.getEmail())).thenReturn(Optional.of(student));
        User admin = new User("Admin", "admin@bmsce.ac.in", encoder.encode("admin-password"), "ADMIN");
        admin.setEmailVerified(true);
        when(users.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
    }
    @Test void resetRequestIsPublicAndDoesNotRevealWhetherAccountExists() throws Exception {
        mvc.perform(post("/api/auth/password-reset/request").contentType("application/json").content("{\"email\":\"missing@bmsce.ac.in\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.message").exists());
    }
    @Test void changeRequiresAuthenticationAndDeniesAppAdministrators() throws Exception {
        mvc.perform(post("/api/auth/change-password").contentType("application/json").content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/change-password").header("Authorization", basic("admin@bmsce.ac.in", "admin-password"))
            .contentType("application/json").content("{\"currentPassword\":\"admin-password\",\"newPassword\":\"new-password\",\"email\":\"student@bmsce.ac.in\"}"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(passwords);
    }
    @Test void changingOwnPasswordRejectsOldBasicCredentialsOnNextRequest() throws Exception {
        when(passwords.change(student.getEmail(), "old-password", "new-password")).thenAnswer(inv -> {
            student.setPassword(encoder.encode("new-password")); return true;
        });
        mvc.perform(post("/api/auth/change-password").header("Authorization", basic(student.getEmail(), "old-password"))
            .contentType("application/json").content("{\"currentPassword\":\"old-password\",\"newPassword\":\"new-password\",\"email\":\"other@bmsce.ac.in\"}"))
            .andExpect(status().isOk());
        verify(passwords).change(student.getEmail(), "old-password", "new-password");
        mvc.perform(post("/api/auth/change-password").header("Authorization", basic(student.getEmail(), "old-password"))
            .contentType("application/json").content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/change-password").header("Authorization", basic(student.getEmail(), "new-password"))
            .contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest());
    }
    @Test void resetCodeWithoutMatchingProofCannotChangePassword() throws Exception {
        mvc.perform(post("/api/auth/password-reset/confirm").contentType("application/json")
            .content("{\"email\":\"student@bmsce.ac.in\",\"otp\":\"000000\",\"newPassword\":\"new-password\"}"))
            .andExpect(status().isBadRequest());
    }
    @Test void serializationNeverExposesPasswordHash() throws Exception {
        String json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(student);
        org.junit.jupiter.api.Assertions.assertFalse(json.contains("password"));
        org.junit.jupiter.api.Assertions.assertFalse(json.contains(student.getPassword()));
    }
}
