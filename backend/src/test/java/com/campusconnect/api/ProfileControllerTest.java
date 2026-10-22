package com.campusconnect.api;

import com.campusconnect.config.SecurityConfig;
import com.campusconnect.model.*;
import com.campusconnect.repo.*;
import java.util.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProfileController.class)
@Import(SecurityConfig.class)
class ProfileControllerTest {
    @Autowired MockMvc mvc;
    @Autowired PasswordEncoder encoder;
    @MockitoBean UserRepository users;
    @MockitoBean AccountProfileRepository profiles;
    User user;
    AccountProfile profile;
    String auth;
    @BeforeEach void setup() {
        user = new User("Owner", "owner@bmsce.ac.in", encoder.encode("password"), "STUDENT");
        user.setId(42L); user.setEmailVerified(true);
        auth = "Basic " + Base64.getEncoder().encodeToString("owner@bmsce.ac.in:password".getBytes());
        profile = new AccountProfile(); profile.userId = 42L;
        when(users.findByEmailIgnoreCase(user.getEmail())).thenReturn(Optional.of(user));
        when(users.lockByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(profiles.findById(42L)).thenReturn(Optional.of(profile));
    }
    @ParameterizedTest @ValueSource(strings={"STUDENT","TEACHER","STAFF","ADMIN"})
    void everyRoleCanReadOwnDetailsWithoutCredentialOrPhotoBytes(String role) throws Exception {
        user.setRole(role); profile.photo = new byte[]{1,2,3};
        mvc.perform(get("/api/profile").header("Authorization",auth))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role))
                .andExpect(jsonPath("$.email").value(user.getEmail()))
                .andExpect(jsonPath("$.hasPhoto").value(true))
                .andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.photo").doesNotExist());
        verify(profiles).findById(42L);
    }
    @Test void cannotChooseAnotherOwnerOrEditEmailRolePasswordOrStatus() throws Exception {
        String hash = user.getPassword();
        mvc.perform(put("/api/profile").header("Authorization",auth).contentType("application/json")
            .content("{\"name\":\" New name \",\"department\":\" AIML \",\"about\":\"Hello\",\"userId\":99,\"email\":\"other@bmsce.ac.in\",\"role\":\"ADMIN\",\"password\":\"hacked\",\"emailVerified\":false}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("New name"))
            .andExpect(jsonPath("$.role").value("STUDENT")).andExpect(jsonPath("$.emailVerified").value(true));
        assertEquals(hash,user.getPassword()); assertEquals("AIML",profile.department);
        verify(profiles,never()).findById(99L);
        mvc.perform(get("/api/profile/99").header("Authorization",auth)).andExpect(status().isNotFound());
    }
    @Test void unauthenticatedAndInactiveAccountsCannotAccessProfiles() throws Exception {
        mvc.perform(get("/api/profile")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/profile/photo")).andExpect(status().isUnauthorized());
        user.setAccountActive(false);
        mvc.perform(get("/api/profile").header("Authorization",auth)).andExpect(status().isUnauthorized());
        verifyNoInteractions(profiles);
    }
    @Test void rejectsInvalidProfileWithoutWriting() throws Exception {
        mvc.perform(put("/api/profile").header("Authorization",auth).contentType("application/json")
            .content("{\"name\":\"  \"}")) .andExpect(status().isBadRequest());
        verify(profiles,never()).save(any());
    }
    @Test void uploadedImageIsSanitizedResizedPrivateAndRemovable() throws Exception {
        var image = new BufferedImage(900,600,BufferedImage.TYPE_INT_RGB);
        var output = new ByteArrayOutputStream(); ImageIO.write(image,"jpeg",output);
        mvc.perform(multipart("/api/profile/photo").file(new MockMultipartFile("file","photo.jpg","image/jpeg",output.toByteArray()))
            .header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$.hasPhoto").value(true));
        var stored = ImageIO.read(new java.io.ByteArrayInputStream(profile.photo));
        assertEquals(512,stored.getWidth()); assertTrue(stored.getHeight()<=512);
        mvc.perform(get("/api/profile/photo").header("Authorization",auth)).andExpect(status().isOk())
            .andExpect(content().contentType("image/png")).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(delete("/api/profile/photo").header("Authorization",auth)).andExpect(status().isOk())
            .andExpect(jsonPath("$.hasPhoto").value(false));
        assertNull(profile.photo);
        mvc.perform(get("/api/profile/photo").header("Authorization",auth)).andExpect(status().isNotFound());
    }
    @Test void rejectsDisguisedOversizedAndOverDimensionImages() throws Exception {
        for (byte[] data : new byte[][]{"not an image".getBytes(),new byte[1024*1024+1]}) {
            mvc.perform(multipart("/api/profile/photo").file(new MockMultipartFile("file","photo.png","image/png",data))
                .header("Authorization",auth)).andExpect(status().isBadRequest());
        }
        var output = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(2049,1,BufferedImage.TYPE_INT_RGB),"png",output);
        mvc.perform(multipart("/api/profile/photo").file(new MockMultipartFile("file","wide.png","image/png",output.toByteArray()))
                .header("Authorization",auth)).andExpect(status().isBadRequest());
        verify(profiles,never()).save(any());
    }
}
