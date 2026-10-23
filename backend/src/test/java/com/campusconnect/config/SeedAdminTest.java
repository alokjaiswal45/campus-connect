package com.campusconnect.config;

import com.campusconnect.model.User;
import com.campusconnect.repo.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SeedAdminTest {
    @Test void restartingNeverOverwritesExistingAdminPassword() throws Exception {
        UserRepository users = mock(UserRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        User admin = new User("Admin","admin@bmsce.ac.in","changed-hash","ADMIN");
        when(users.findByEmailIgnoreCase(admin.getEmail())).thenReturn(Optional.of(admin));
        new SeedAdmin().seed(users,encoder,admin.getEmail(),"original-config-password").run();
        assertEquals("changed-hash",admin.getPassword());
        verify(users,never()).save(any()); verifyNoInteractions(encoder);
    }
}
