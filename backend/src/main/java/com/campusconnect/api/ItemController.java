package com.campusconnect.api;

import com.campusconnect.model.LostItem;
import com.campusconnect.repo.LostItemRepository;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ClaimDisputeRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/items")
public class ItemController {
    private final LostItemRepository repo;
    private final ItemClaimRepository claims;
    private final ClaimDisputeRepository disputes;
    public ItemController(LostItemRepository repo, ItemClaimRepository claims,
            ClaimDisputeRepository disputes) {
        this.repo = repo;
        this.claims = claims;
        this.disputes = disputes;
    }

    public record ItemRequest(String title, String description, String location,
            String category, String kind) {}

    public record PublicItem(Long id, String title, String description,
            String location, String category, String kind, String status,
            String postedBy, Instant createdAt) {
        static PublicItem from(LostItem item) {
            return new PublicItem(item.id, item.title, item.description, item.location,
                    item.category, item.kind, item.status, item.postedBy, item.createdAt);
        }
    }

    @GetMapping
    public List<PublicItem> all() {
        return repo.findAll().stream().map(PublicItem::from).toList();
    }

    @PostMapping
    public ResponseEntity<PublicItem> create(@RequestBody ItemRequest request, Authentication auth) {
        if (request == null || request.title() == null || request.title().isBlank()
                || request.title().length() > 255 || request.kind() == null
                || !List.of("LOST", "FOUND").contains(request.kind().toUpperCase())
                || request.description() != null && request.description().length() > 3000
                || request.location() != null && request.location().length() > 255
                || request.category() != null && request.category().length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid item report");
        }
        LostItem item = new LostItem();
        item.title = request.title().trim();
        item.description = request.description();
        item.location = request.location();
        item.category = request.category();
        item.kind = request.kind().toUpperCase();
        item.postedBy = auth.getName();
        item.status = "OPEN";
        item.createdAt = Instant.now();
        return ResponseEntity.status(HttpStatus.CREATED).body(PublicItem.from(repo.save(item)));
    }

    @PutMapping("/{id}/close")
    @Transactional
    public ResponseEntity<PublicItem> close(@PathVariable Long id, Authentication auth) {
        LostItem item = repo.lockById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found"));
        boolean admin = auth.getAuthorities().stream().anyMatch(a ->
                List.of("ROLE_ADMIN", "ROLE_SUPER_ADMIN").contains(a.getAuthority()));
        if (!auth.getName().equalsIgnoreCase(item.postedBy) && !admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized");
        }
        if ("FOUND".equalsIgnoreCase(item.kind) && item.custodyAcceptedAt != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Item in staff custody must be resolved through verified handover");
        }
        if (claims.existsByItemIdAndStatusIn(id, List.of("PENDING", "APPROVED"))
                || disputes.existsOpenForItem(id, "OPEN")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Resolve active ownership claims and disputes before closing the item");
        }
        item.status = "RESOLVED";
        return ResponseEntity.ok(PublicItem.from(repo.save(item)));
    }
}
