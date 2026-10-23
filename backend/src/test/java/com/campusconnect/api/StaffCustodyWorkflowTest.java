package com.campusconnect.api;

import com.campusconnect.model.LostItem;
import com.campusconnect.model.User;
import com.campusconnect.repo.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:custody_workflow;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "spring.jpa.show-sql=false",
    "spring.mail.username=sender@example.test", "spring.mail.host=localhost",
    "app.upload-dir=${java.io.tmpdir}/campus-custody-test-uploads",
    "app.admin.email=admin@bmsce.ac.in", "app.admin.password=test-admin-password"
})
@AutoConfigureMockMvc
class StaffCustodyWorkflowTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired LostItemRepository items;
    @Autowired PasswordEncoder encoder;
    @MockitoBean JavaMailSender mail;
    private String basic(String email) {
        return "Basic " + Base64.getEncoder().encodeToString((email + ":test-password-123").getBytes(StandardCharsets.UTF_8));
    }
    @BeforeEach void users() {
        for (String role : new String[] {"STUDENT", "STAFF"}) {
            String email = role.toLowerCase() + "@bmsce.ac.in";
            User user = users.findByEmailIgnoreCase(email).orElseGet(User::new);
            user.setEmail(email); user.setName(role); user.setRole(role);
            user.setPassword(encoder.encode("test-password-123"));
            user.setEmailVerified(true); user.setAccountActive(true);
            users.saveAndFlush(user);
        }
    }
    private JsonNode inventoryItem(Long id) throws Exception {
        var response = mvc.perform(get("/api/staff/items/inventory").header("Authorization", basic("staff@bmsce.ac.in")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        for (JsonNode item : json.readTree(response)) if (item.path("id").asLong() == id) return item;
        fail("Missing stored item " + id); return null;
    }
    @ParameterizedTest @ValueSource(strings = {"LOST", "FOUND"})
    void intakePersistsAcrossReadsAndEnablesVerifiedApprovalAndHandover(String kind) throws Exception {
        LostItem item = new LostItem(); item.title = "Calculator " + kind; item.kind = kind;
        item.status = "OPEN"; item.postedBy = "reporter@bmsce.ac.in";
        item = items.saveAndFlush(item);
        String claimBody = mvc.perform(post("/api/items/" + item.id + "/claims")
            .header("Authorization", basic("student@bmsce.ac.in")).contentType("application/json")
            .content("{\"ownershipAnswer\":\"My initials are inside the blue protective case\"}"))
            .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long claimId = json.readTree(claimBody).path("id").asLong();
        mvc.perform(put("/api/staff/claims/" + claimId + "/review").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"approve\":true}"))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.detail").value("Staff must physically receive the item before approval"));
        String receiptBody = mvc.perform(put("/api/staff/items/" + item.id + "/intake")
            .header("Authorization", basic("staff@bmsce.ac.in")).contentType("application/json")
            .content("{\"storageLocation\":\"Locker 1 · Shelf A\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String receivedAt = json.readTree(receiptBody).path("custodyAcceptedAt").asText();
        assertFalse(receivedAt.isBlank());
        assertEquals("Locker 1 · Shelf A", inventoryItem(item.id).path("custodyLocation").asText());
        assertEquals(receivedAt, inventoryItem(item.id).path("custodyAcceptedAt").asText());
        mvc.perform(put("/api/staff/items/" + item.id + "/intake").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"storageLocation\":\"Locker 1 · Shelf A\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.custodyAcceptedAt").value(receivedAt));
        mvc.perform(put("/api/staff/items/" + item.id + "/intake").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"storageLocation\":\"Locker 99\"}"))
            .andExpect(status().isConflict());
        assertEquals("Locker 1 · Shelf A", inventoryItem(item.id).path("custodyLocation").asText());
        mvc.perform(put("/api/staff/claims/" + claimId + "/review").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"approve\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"))
            .andExpect(jsonPath("$.pickupReference").isEmpty());
        String mine = mvc.perform(get("/api/claims/mine").header("Authorization", basic("student@bmsce.ac.in")))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String pickup = null;
        for (JsonNode claim : json.readTree(mine)) if (claim.path("id").asLong() == claimId) pickup = claim.path("pickupReference").asText();
        assertNotNull(pickup);
        mvc.perform(put("/api/staff/claims/" + claimId + "/handover").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"pickupReference\":\"wrong\",\"collegeIdChecked\":true}"))
            .andExpect(status().isBadRequest());
        mvc.perform(put("/api/staff/claims/" + claimId + "/handover").header("Authorization", basic("staff@bmsce.ac.in"))
            .contentType("application/json").content("{\"pickupReference\":\"" + pickup + "\",\"collegeIdChecked\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("HANDED_OVER"));
        JsonNode resolved = inventoryItem(item.id);
        assertEquals("RESOLVED", resolved.path("status").asText());
        assertEquals("Locker 1 · Shelf A", resolved.path("custodyLocation").asText());
        assertEquals(receivedAt, resolved.path("custodyAcceptedAt").asText());
    }
}
