package com.campusconnect.api;

import com.campusconnect.model.ClaimDispute;
import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ClaimDisputeRepository;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.LostItemRepository;
import java.util.Optional;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClaimDisputeControllerTest {
    private final ClaimDisputeRepository disputes = mock(ClaimDisputeRepository.class);
    private final ItemClaimRepository claims = mock(ItemClaimRepository.class);
    private final LostItemRepository items = mock(LostItemRepository.class);
    private final ClaimDisputeController controller =
            new ClaimDisputeController(disputes, claims, items, mock(EntityManager.class));
    private final UsernamePasswordAuthenticationToken student =
            new UsernamePasswordAuthenticationToken("owner@bmsce.ac.in", "unused");

    @Test
    void upheldRejectedDisputeReopensClaimWithoutGrantingCustody() {
        LostItem item = new LostItem();
        item.id = 3L;
        item.status = "OPEN";
        ItemClaim claim = new ItemClaim();
        claim.id = 4L;
        claim.item = item;
        claim.status = "REJECTED";
        claim.reviewedBy = "desk@bmsce.ac.in";
        claim.pickupReference = "OLD12345";
        ClaimDispute dispute = new ClaimDispute();
        dispute.id = 2L;
        dispute.status = "OPEN";
        dispute.openedBy = "owner@bmsce.ac.in";
        dispute.claim = claim;
        when(disputes.findById(2L)).thenReturn(Optional.of(dispute));
        when(items.lockById(3L)).thenReturn(Optional.of(item));
        when(disputes.save(dispute)).thenReturn(dispute);
        var admin = new UsernamePasswordAuthenticationToken("admin@bmsce.ac.in", "unused");
        var result = controller.resolve(2L, new ClaimDisputeController.ResolveRequest(
                "Appeal accepted; independent staff re-review required", true), admin);
        assertEquals("UPHELD", result.status());
        assertEquals("PENDING", claim.status);
        assertNull(claim.pickupReference);
        assertNull(claim.reviewedBy);
        verify(claims).save(claim);
        assertEquals("OPEN", item.status);
    }

    @Test
    void upheldRejectedDisputeCannotOverrideAnotherApprovedClaim() {
        LostItem item = new LostItem();
        item.id = 3L;
        item.status = "OPEN";
        ItemClaim claim = new ItemClaim();
        claim.item = item;
        claim.status = "REJECTED";
        ClaimDispute dispute = new ClaimDispute();
        dispute.status = "OPEN";
        dispute.openedBy = "owner@bmsce.ac.in";
        dispute.claim = claim;
        when(disputes.findById(2L)).thenReturn(Optional.of(dispute));
        when(items.lockById(3L)).thenReturn(Optional.of(item));
        when(claims.existsByItemIdAndStatusIn(eq(3L), anyList())).thenReturn(true);
        var admin = new UsernamePasswordAuthenticationToken("admin@bmsce.ac.in", "unused");
        assertThrows(ResponseStatusException.class, () ->
                controller.resolve(2L, new ClaimDisputeController.ResolveRequest(
                        "Appeal accepted but ownership already assigned", true), admin));
        verify(claims, never()).save(any());
        verify(disputes, never()).save(any());
    }

    @Test
    void cannotOpenDisputeAfterCompletedHandover() {
        LostItem item = new LostItem();
        item.id = 3L;
        item.status = "RESOLVED";
        ItemClaim claim = new ItemClaim();
        claim.item = item;
        claim.status = "APPROVED";
        claim.claimantEmail = "owner@bmsce.ac.in";
        when(claims.findById(10L)).thenReturn(Optional.of(claim));
        when(items.lockById(3L)).thenReturn(Optional.of(item));
        assertThrows(ResponseStatusException.class, () ->
                controller.open(10L, new ClaimDisputeController.OpenRequest(
                        "This decision should be reviewed"), student));
        verify(disputes, never()).save(any());
    }

    @Test
    void anotherStudentCannotDisputePrivateClaim() {
        ItemClaim claim = new ItemClaim();
        claim.claimantEmail = "different@bmsce.ac.in";
        when(claims.findById(10L)).thenReturn(Optional.of(claim));
        assertThrows(ResponseStatusException.class, () ->
                controller.open(10L, new ClaimDisputeController.OpenRequest(
                        "This decision should be reviewed"), student));
        verify(disputes, never()).save(any());
    }

    @Test
    void reviewedStaffMemberCannotResolveOwnDispute() {
        ClaimDispute dispute = new ClaimDispute();
        dispute.status = "OPEN";
        dispute.openedBy = "owner@bmsce.ac.in";
        ItemClaim claim = new ItemClaim();
        claim.reviewedBy = "reviewer@bmsce.ac.in";
        claim.item = new LostItem();
        claim.item.id = 3L;
        dispute.claim = claim;
        when(disputes.findById(2L)).thenReturn(Optional.of(dispute));
        when(items.lockById(3L)).thenReturn(Optional.of(claim.item));
        var reviewer = new UsernamePasswordAuthenticationToken("reviewer@bmsce.ac.in", "unused");
        assertThrows(ResponseStatusException.class, () ->
                controller.resolve(2L, new ClaimDisputeController.ResolveRequest(
                        "This decision is independently reviewed", true), reviewer));
        verify(disputes, never()).save(any());
    }
}
