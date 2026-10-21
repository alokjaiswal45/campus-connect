package com.campusconnect.api;

import com.campusconnect.model.ClaimDispute;
import com.campusconnect.model.ItemClaim;
import com.campusconnect.repo.ClaimDisputeRepository;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.LostItemRepository;
import java.time.Instant;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ClaimDisputeController {
    private final ClaimDisputeRepository disputes;
    private final ItemClaimRepository claims;
    private final LostItemRepository items;
    private final EntityManager entityManager;

    public ClaimDisputeController(ClaimDisputeRepository disputes, ItemClaimRepository claims,
            LostItemRepository items, EntityManager entityManager) {
        this.disputes = disputes;
        this.claims = claims;
        this.items = items;
        this.entityManager = entityManager;
    }

    public record OpenRequest(String reason) {}
    public record ResolveRequest(String resolution, boolean upholdClaim) {}
    public record DisputeView(Long id, Long claimId, String status, String reason,
            String resolution, Instant createdAt, Instant resolvedAt, String openedBy) {
        static DisputeView from(ClaimDispute d) {
            return new DisputeView(d.id, d.claim.id, d.status, d.reason, d.resolution,
                    d.createdAt, d.resolvedAt, d.openedBy);
        }
    }

    @PostMapping("/claims/{claimId}/disputes")
    @Transactional
    public ResponseEntity<DisputeView> open(@PathVariable Long claimId,
            @RequestBody OpenRequest request, Authentication auth) {
        if (request == null || request.reason() == null
                || request.reason().trim().length() < 10 || request.reason().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reason must be 10-2000 characters");
        }
        ItemClaim claim = claims.findById(claimId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        if (!auth.getName().equalsIgnoreCase(claim.claimantEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your claim");
        }
        items.lockById(claim.item.id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        // Refresh the managed claim after waiting for the item lock.
        entityManager.refresh(claim);
        if (!"OPEN".equals(claim.item.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Item is already resolved; contact an administrator for post-handover issues");
        }
        if (!List.of("REJECTED", "APPROVED").contains(claim.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This claim cannot be disputed");
        }
        if (disputes.existsByClaimIdAndStatus(claimId, "OPEN")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An open dispute already exists");
        }
        ClaimDispute dispute = new ClaimDispute();
        dispute.claim = claim;
        dispute.openedBy = auth.getName();
        dispute.reason = request.reason().trim();
        return ResponseEntity.status(HttpStatus.CREATED).body(DisputeView.from(disputes.save(dispute)));
    }

    @GetMapping("/disputes/mine")
    public List<DisputeView> mine(Authentication auth) {
        return disputes.findByOpenedByIgnoreCaseOrderByCreatedAtDesc(auth.getName())
                .stream().map(DisputeView::from).toList();
    }

    @GetMapping("/admin/disputes")
    public List<DisputeView> pending() {
        return disputes.findByStatusOrderByCreatedAtAsc("OPEN")
                .stream().map(DisputeView::from).toList();
    }

    @PutMapping("/admin/disputes/{id}/resolve")
    @Transactional
    public DisputeView resolve(@PathVariable Long id, @RequestBody ResolveRequest request,
            Authentication auth) {
        if (request == null || request.resolution() == null
                || request.resolution().trim().length() < 10 || request.resolution().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resolution must be 10-2000 characters");
        }
        ClaimDispute dispute = disputes.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Dispute not found"));
        items.lockById(dispute.claim.item.id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        entityManager.refresh(dispute);
        if (!"OPEN".equals(dispute.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Dispute already resolved");
        }
        if (auth.getName().equalsIgnoreCase(dispute.openedBy)
                || auth.getName().equalsIgnoreCase(dispute.claim.reviewedBy)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Independent administrator review required");
        }
        // Administrative dispute resolution records a decision; it never silently transfers custody
        // or overrides a completed handover. Staff must use the standard verified handover workflow.
        dispute.status = request.upholdClaim() ? "UPHELD" : "DISMISSED";
        dispute.resolution = request.resolution().trim();
        dispute.resolvedBy = auth.getName();
        dispute.resolvedAt = Instant.now();
        return DisputeView.from(disputes.save(dispute));
    }
}
