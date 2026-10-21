package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.LostItemRepository;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemClaimControllerTest {
    private final ItemClaimRepository claims = mock(ItemClaimRepository.class);
    private final LostItemRepository items = mock(LostItemRepository.class);
    private final EntityManager em = mock(EntityManager.class);
    private final ItemClaimController controller = new ItemClaimController(claims, items, em);
    private final UsernamePasswordAuthenticationToken staff =
            new UsernamePasswordAuthenticationToken("desk@bmsce.ac.in", "unused");

    @Test
    void staffCannotApproveBeforePhysicalIntake() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.postedBy = "finder@bmsce.ac.in";
        ItemClaim claim = new ItemClaim();
        claim.id = 20L;
        claim.item = item;
        claim.claimantEmail = "owner@bmsce.ac.in";
        when(claims.findById(20L)).thenReturn(Optional.of(claim));
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        assertThrows(ResponseStatusException.class, () ->
                controller.review(20L, new ItemClaimController.ReviewRequest(true), staff));
        verify(claims, never()).save(any());
    }

    @Test
    void studentCannotClaimOwnPosting() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.kind = "FOUND";
        item.status = "OPEN";
        item.postedBy = "student@bmsce.ac.in";
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        var owner = new UsernamePasswordAuthenticationToken("student@bmsce.ac.in", "unused");
        assertThrows(ResponseStatusException.class, () ->
                controller.claim(10L, new ItemClaimController.ClaimRequest(
                        "My wallet has a blue card inside"), owner));
        verify(claims, never()).save(any());
    }

    @Test
    void cannotHandoverPendingClaim() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.custodyAcceptedAt = java.time.Instant.now();
        ItemClaim claim = new ItemClaim();
        claim.id = 20L;
        claim.item = item;
        claim.status = "PENDING";
        when(claims.findById(20L)).thenReturn(Optional.of(claim));
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        assertThrows(ResponseStatusException.class, () ->
                controller.handover(20L,
                        new ItemClaimController.HandoverRequest("ABC123", true), staff));
        verify(claims, never()).save(any());
    }
}
