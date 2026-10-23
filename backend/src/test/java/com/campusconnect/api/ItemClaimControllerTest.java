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
    private final ClaimDisputeRepository disputes = mock(ClaimDisputeRepository.class);
    private final ItemClaimController controller = new ItemClaimController(claims, items, em, disputes);
    private final UsernamePasswordAuthenticationToken staff =
            new UsernamePasswordAuthenticationToken("desk@bmsce.ac.in", "unused");

    @Test
    void ownershipClaimOnLostReportReachesStaffWithPrivateDetails() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.kind = "LOST";
        item.status = "OPEN";
        item.postedBy = "reporter@bmsce.ac.in";
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        when(claims.save(any(ItemClaim.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var claimant = new UsernamePasswordAuthenticationToken("owner@bmsce.ac.in", "unused");
        var response = controller.claim(10L,
                new ItemClaimController.ClaimRequest("Lost at library; my initials are inside the case"), claimant);
        assertEquals("PENDING", response.getBody().status());
        assertEquals("owner@bmsce.ac.in", response.getBody().claimantEmail());
        var saved = org.mockito.ArgumentCaptor.forClass(ItemClaim.class);
        verify(claims).save(saved.capture());
        when(claims.findByItemIdOrderByCreatedAtDesc(10L)).thenReturn(java.util.List.of(saved.getValue()));
        var staffClaims = controller.forItem(10L);
        assertEquals(response.getBody().ownershipAnswer(), staffClaims.get(0).ownershipAnswer());
        assertEquals("owner@bmsce.ac.in", staffClaims.get(0).claimantEmail());
    }

    @Test
    void recoveredLostItemCanBePhysicallyReceivedBeforeClaimApproval() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.kind = "LOST";
        item.status = "OPEN";
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        when(items.save(item)).thenReturn(item);
        var intake = controller.intake(10L, new ItemClaimController.IntakeRequest("Locker B"), staff);
        assertNotNull(intake.custodyAcceptedAt());
        assertEquals("Locker B", intake.custodyLocation());
        assertEquals("desk@bmsce.ac.in", intake.custodyAcceptedBy());
    }

    @Test
    void inventoryReturnsLostAndFoundReportsAndRetainsStaffCustodyDetails() {
        LostItem found = new LostItem();
        found.id = 1L;
        found.kind = "FOUND";
        found.custodyLocation = "Staff locker A";
        LostItem lost = new LostItem();
        lost.id = 2L;
        lost.kind = "LOST";
        when(items.findAll()).thenReturn(java.util.List.of(found, lost));
        var inventory = controller.inventory();
        assertEquals(2, inventory.size());
        assertEquals(1L, inventory.get(0).id());
        assertEquals("Staff locker A", inventory.get(0).custodyLocation());
        assertEquals(2L, inventory.get(1).id());
        assertEquals("LOST", inventory.get(1).kind());
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
    void competingOwnershipAppealBlocksApproval() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.status = "OPEN";
        item.custodyAcceptedAt = java.time.Instant.now();
        ItemClaim claim = new ItemClaim();
        claim.id = 20L;
        claim.item = item;
        claim.status = "PENDING";
        claim.claimantEmail = "owner@bmsce.ac.in";
        when(claims.findById(20L)).thenReturn(Optional.of(claim));
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        when(disputes.existsOpenForItem(10L, "OPEN")).thenReturn(true);
        assertThrows(ResponseStatusException.class, () ->
                controller.review(20L, new ItemClaimController.ReviewRequest(true), staff));
        verify(claims, never()).save(any());
    }

    @Test
    void competingOwnershipAppealBlocksHandover() {
        LostItem item = new LostItem();
        item.id = 10L;
        item.status = "OPEN";
        item.custodyAcceptedAt = java.time.Instant.now();
        ItemClaim claim = new ItemClaim();
        claim.id = 20L;
        claim.item = item;
        claim.status = "APPROVED";
        claim.pickupReference = "ABC12345";
        when(claims.findById(20L)).thenReturn(Optional.of(claim));
        when(items.lockById(10L)).thenReturn(Optional.of(item));
        when(disputes.existsOpenForItem(10L, "OPEN")).thenReturn(true);
        assertThrows(ResponseStatusException.class, () ->
                controller.handover(20L,
                        new ItemClaimController.HandoverRequest("ABC12345", true), staff));
        verify(claims, never()).save(any());
        verify(items, never()).save(any());
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
