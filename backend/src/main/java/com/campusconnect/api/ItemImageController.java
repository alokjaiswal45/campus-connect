package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.ItemImage;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ItemImageRepository;
import com.campusconnect.repo.LostItemRepository;
import java.util.List;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class ItemImageController {
    private final ItemImageRepository images;
    private final LostItemRepository items;
    private final ItemClaimRepository claims;
    public ItemImageController(ItemImageRepository images, LostItemRepository items,
            ItemClaimRepository claims) {
        this.images = images;
        this.items = items;
        this.claims = claims;
    }

    public record ImageView(Long id, Long itemId, Long claimId) {}
    private boolean desk(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a ->
                List.of("ROLE_STAFF", "ROLE_ADMIN", "ROLE_SUPER_ADMIN").contains(a.getAuthority()));
    }

    private String verifiedType(byte[] bytes) {
        if (bytes.length >= 3 && (bytes[0] & 255) == 255
                && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255) return "image/jpeg";
        if (bytes.length >= 8 && (bytes[0] & 255) == 137
                && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71
                && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10) return "image/png";
        if (bytes.length >= 12 && bytes[0] == 'R' && bytes[1] == 'I'
                && bytes[2] == 'F' && bytes[3] == 'F' && bytes[8] == 'W'
                && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return "image/webp";
        throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Only JPEG, PNG and WebP images are supported");
    }

    private ItemImage saveImage(LostItem item, ItemClaim claim,
            MultipartFile file, Authentication auth) throws java.io.IOException {
        if (file == null || file.isEmpty() || file.getSize() > 5 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be 1 byte to 5 MB");
        }
        byte[] bytes = file.getBytes();
        ItemImage image = new ItemImage();
        image.item = item;
        image.claim = claim;
        image.uploadedBy = auth.getName();
        image.contentType = verifiedType(bytes);
        image.data = bytes;
        return images.save(image);
    }

    @PostMapping(value = "/items/{itemId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImageView uploadItem(@PathVariable Long itemId, @RequestPart("file") MultipartFile file,
            Authentication auth) throws java.io.IOException {
        LostItem item = items.findById(itemId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!auth.getName().equalsIgnoreCase(item.postedBy) && !desk(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!"OPEN".equals(item.status)) throw new ResponseStatusException(HttpStatus.CONFLICT);
        if (images.findByItemIdAndClaimIsNullOrderByCreatedAtAsc(itemId).size() >= 3) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Maximum three item photos");
        }
        ItemImage image = saveImage(item, null, file, auth);
        return new ImageView(image.id, itemId, null);
    }

    @GetMapping("/items/{itemId}/images")
    public List<ImageView> listItemImages(@PathVariable Long itemId) {
        return images.findByItemIdAndClaimIsNullOrderByCreatedAtAsc(itemId)
                .stream().map(i -> new ImageView(i.id, itemId, null)).toList();
    }

    @PostMapping(value = "/claims/{claimId}/evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ImageView uploadEvidence(@PathVariable Long claimId, @RequestPart("file") MultipartFile file,
            Authentication auth) throws java.io.IOException {
        ItemClaim claim = claims.findById(claimId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!auth.getName().equalsIgnoreCase(claim.claimantEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (!"PENDING".equals(claim.status)) throw new ResponseStatusException(HttpStatus.CONFLICT);
        if (!images.findByClaimIdOrderByCreatedAtAsc(claimId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only one evidence image allowed");
        }
        ItemImage image = saveImage(claim.item, claim, file, auth);
        return new ImageView(image.id, claim.item.id, claimId);
    }

    @GetMapping("/claims/{claimId}/evidence")
    public List<ImageView> listEvidence(@PathVariable Long claimId, Authentication auth) {
        ItemClaim claim = claims.findById(claimId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!auth.getName().equalsIgnoreCase(claim.claimantEmail) && !desk(auth)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return images.findByClaimIdOrderByCreatedAtAsc(claimId)
                .stream().map(i -> new ImageView(i.id, i.item.id, claimId)).toList();
    }

    @GetMapping("/images/{id}")
    public ResponseEntity<byte[]> get(@PathVariable Long id, Authentication auth) {
        ItemImage image = images.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (image.claim != null && !desk(auth)
                && !auth.getName().equalsIgnoreCase(image.claim.claimantEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType))
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .body(image.data);
    }
}
