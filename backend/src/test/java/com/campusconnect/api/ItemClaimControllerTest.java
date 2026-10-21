package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ClaimDisputeRepository;
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
    private final ItemClaimController controller = new ItemClaimController(claims, items, em, mock(ClaimDisputeRepository.class));
    private final UsernamePasswordAuthenticationToken staff =
            new UsernamePasswordAuthenticationToken("desk@bmsce.ac.in", "unused");

    @Test
    void inventoryOnlyReturnsFoundItemsAndRetainsStaffCustodyDetails() {
        LostItem found = new LostItem();
        found.id = 1L;
        found.kind = "FOUND";
        found.custodyLocation = "Staff locker A";
        LostItem lost = new LostItem();
        lost.id = 2L;
        lost.kind = "LOST";
        when(items.findAll()).thenReturn(java.util.List.of(found, lost));
        var inventory = controller.inventory();
        assertEquals(1, inventory.size());
        assertEquals(1L, inventory.get(0).id());
        assertEquals("Staff locker A", inventory.get(0).custodyLocation());
    }

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
    void closedItemCannotBeApproved() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.status = "RESOLVED";
        item.custodyAcceptedAt = java.time.Instant.now();
        ItemClaim claim = new ItemClaim();
        claim.id = 20L;
        claim.item = item;
        claim.status = "PENDING";
        claim.claimantEmail = "owner@bmsce.ac.in";
        when(claims.findById(20L)).thenReturn(Optional.of(claim));
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        assertThrows(ResponseStatusException.class, () ->
                controller.review(20L, new ItemClaimController.ReviewRequest(true), staff));
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
