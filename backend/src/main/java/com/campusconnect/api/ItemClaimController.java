package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ClaimDisputeRepository;
import com.campusconnect.repo.LostItemRepository;
import java.time.Instant;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ItemClaimController {
    private final ItemClaimRepository claims;
    private final LostItemRepository items;
    private final EntityManager entityManager;
    private final ClaimDisputeRepository disputes;

    public ItemClaimController(ItemClaimRepository claims, LostItemRepository items,
            EntityManager entityManager, ClaimDisputeRepository disputes) {
        this.claims = claims;
        this.items = items;
        this.entityManager = entityManager;
        this.disputes = disputes;
    }

    public record ClaimRequest(String ownershipAnswer) {}
    public record IntakeRequest(String storageLocation) {}
    public record ReviewRequest(boolean approve) {}
    public record HandoverRequest(String pickupReference, boolean collegeIdChecked) {}
    public record ClaimView(Long id, Long itemId, String claimantEmail, String ownershipAnswer,
            String status, Instant createdAt, String pickupReference, Instant handedOverAt) {
        static ClaimView from(ItemClaim c, boolean includePrivate) {
            return new ClaimView(c.id, c.item.id,
                    includePrivate ? c.claimantEmail : null,
                    includePrivate ? c.ownershipAnswer : null,
                    c.status, c.createdAt,
                    includePrivate ? c.pickupReference : null, c.handedOverAt);
        }
    }

    private ItemClaim lockClaimItemThenRead(Long id) {
        ItemClaim existing = claims.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found"));
        items.lockById(existing.item.id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        // Refresh the already managed claim after waiting for the item lock.
        entityManager.refresh(existing);
        return existing;
    }

    public record StaffItemView(Long id, String title, String description, String location,
            String category, String kind, String status, String postedBy, Instant createdAt,
            Instant custodyAcceptedAt, String custodyAcceptedBy, String custodyLocation) {
        static StaffItemView from(LostItem i) {
            return new StaffItemView(i.id, i.title, i.description, i.location,
                    i.category, i.kind, i.status, i.postedBy, i.createdAt,
                    i.custodyAcceptedAt, i.custodyAcceptedBy, i.custodyLocation);
        }
    }

    @GetMapping("/staff/items/inventory")
    public List<StaffItemView> inventory() {
        return items.findAll().stream()
                .filter(item -> "FOUND".equalsIgnoreCase(item.kind))
                .map(StaffItemView::from).toList();
    }

    @PutMapping("/staff/items/{itemId}/intake")
    @Transactional
    public StaffItemView intake(@PathVariable Long itemId, @RequestBody IntakeRequest request,
            Authentication auth) {
        LostItem item = items.lockById(itemId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        if (!"FOUND".equalsIgnoreCase(item.kind) || !"OPEN".equals(item.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only open found items can be received");
        }
        if (item.custodyAcceptedAt != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already in custody");
        }
        if (request == null || request.storageLocation() == null
                || request.storageLocation().isBlank() || request.storageLocation().length() > 255) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Storage location required");
        }
        item.custodyAcceptedAt = Instant.now();
        item.custodyAcceptedBy = auth.getName();
        item.custodyLocation = request.storageLocation().trim();
        return StaffItemView.from(items.save(item));
    }

    @PostMapping("/items/{itemId}/claims")
    @Transactional
    public ResponseEntity<ClaimView> claim(@PathVariable Long itemId,
            @RequestBody ClaimRequest request, Authentication auth) {
        if (request == null || request.ownershipAnswer() == null
                || request.ownershipAnswer().trim().length() < 10
                || request.ownershipAnswer().length() > 2000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Provide ownership details (10-2000 characters)");
        }
        LostItem item = items.lockById(itemId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        if (!"FOUND".equalsIgnoreCase(item.kind) || !"OPEN".equals(item.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is not available for claims");
        }
        if (auth.getName().equalsIgnoreCase(item.postedBy)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot claim your own posting");
        }
        if (claims.existsByItemIdAndClaimantEmailIgnoreCase(itemId, auth.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Claim already submitted");
        }
        ItemClaim claim = new ItemClaim();
        claim.item = item;
        claim.claimantEmail = auth.getName();
        claim.ownershipAnswer = request.ownershipAnswer().trim();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ClaimView.from(claims.save(claim), true));
    }

    @GetMapping("/claims/mine")
    public List<ClaimView> mine(Authentication auth) {
        return claims.findByClaimantEmailIgnoreCaseOrderByCreatedAtDesc(auth.getName())
                .stream().map(c -> ClaimView.from(c, true)).toList();
    }

    @GetMapping("/staff/items/{itemId}/claims")
    public List<ClaimView> forItem(@PathVariable Long itemId) {
        return claims.findByItemIdOrderByCreatedAtDesc(itemId)
                .stream().map(c -> ClaimView.from(c, true)).toList();
    }

    @PutMapping("/staff/claims/{id}/review")
    @Transactional
    public ClaimView review(@PathVariable Long id, @RequestBody ReviewRequest request,
            Authentication auth) {
        ItemClaim claim = lockClaimItemThenRead(id);
        if (!"PENDING".equals(claim.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Claim already reviewed");
        }
        if (auth.getName().equalsIgnoreCase(claim.claimantEmail)
                || auth.getName().equalsIgnoreCase(claim.item.postedBy)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Self-approval is prohibited");
        }
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review decision required");
        }
        if (!"OPEN".equals(claim.item.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item is no longer open");
        }
        if (request.approve() && disputes.existsOpenForItem(claim.item.id, "OPEN")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Resolve all open ownership disputes for this item before approval");
        }
        if (request.approve() && claim.item.custodyAcceptedAt == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Staff must physically receive the item before approval");
        }
        if (request.approve() && claims.existsByItemIdAndStatusIn(
                claim.item.id, List.of("APPROVED", "HANDED_OVER"))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already assigned");
        }
        claim.status = request.approve() ? "APPROVED" : "REJECTED";
        claim.reviewedAt = Instant.now();
        claim.reviewedBy = auth.getName();
        if (request.approve()) {
            claim.pickupReference = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        }
        return ClaimView.from(claims.save(claim), true);
    }

    @PutMapping("/staff/claims/{id}/handover")
    @Transactional
    public ClaimView handover(@PathVariable Long id, @RequestBody HandoverRequest request,
            Authentication auth) {
        ItemClaim claim = lockClaimItemThenRead(id);
        if (!"OPEN".equals(claim.item.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item already resolved");
        }
        if (claim.item.custodyAcceptedAt == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Item not in staff custody");
        }
        if (disputes.existsOpenForItem(claim.item.id, "OPEN")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Resolve all open ownership disputes for this item before handover");
        }
        if (!"APPROVED".equals(claim.status)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Claim not approved or already handed over");
        }
        if (request == null || !request.collegeIdChecked()
                || request.pickupReference() == null
                || !request.pickupReference().equalsIgnoreCase(claim.pickupReference)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Verify college ID and correct pickup reference");
        }
        if (auth.getName().equalsIgnoreCase(claim.claimantEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cannot hand over to yourself");
        }
        claim.status = "HANDED_OVER";
        claim.handedOverAt = Instant.now();
        claim.handedOverBy = auth.getName();
        claim.item.status = "RESOLVED";
        items.save(claim.item);
        return ClaimView.from(claims.save(claim), true);
    }
}
