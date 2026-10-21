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
