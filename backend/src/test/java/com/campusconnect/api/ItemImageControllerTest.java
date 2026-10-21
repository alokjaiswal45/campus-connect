package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.ItemImage;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ItemImageRepository;
import com.campusconnect.repo.LostItemRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemImageControllerTest {
    private final ItemImageRepository images = mock(ItemImageRepository.class);
    private final LostItemRepository items = mock(LostItemRepository.class);
    private final ItemClaimRepository claims = mock(ItemClaimRepository.class);
    private final ItemImageController controller = new ItemImageController(images, items, claims);

    private UsernamePasswordAuthenticationToken login(String email) {
        return new UsernamePasswordAuthenticationToken(email, "unused");
    }

    @Test
    void privateEvidenceCannotBeDownloadedByAnotherStudent() {
        ItemImage image = new ItemImage();
        ItemClaim claim = new ItemClaim();
        claim.claimantEmail = "owner@bmsce.ac.in";
        image.claim = claim;
        when(images.findById(1L)).thenReturn(Optional.of(image));
        assertThrows(ResponseStatusException.class, () ->
                controller.get(1L, login("stranger@bmsce.ac.in")));
    }

    @Test
    void malformedImageIsRejected() throws Exception {
        LostItem item = new LostItem();
        item.postedBy = "finder@bmsce.ac.in";
        item.status = "OPEN";
        when(items.lockById(2L)).thenReturn(Optional.of(item));
        MockMultipartFile file = new MockMultipartFile("file", "bad.png", "image/png",
                new byte[] { (byte)137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3 });
        assertThrows(Exception.class, () ->
                controller.uploadItem(2L, file, login("finder@bmsce.ac.in")));
        verify(images, never()).save(any());
    }

    @Test
    void nonOwnerCannotUploadItemImage() {
        LostItem item = new LostItem();
        item.postedBy = "finder@bmsce.ac.in";
        item.status = "OPEN";
        when(items.lockById(2L)).thenReturn(Optional.of(item));
        MockMultipartFile file = new MockMultipartFile("file", "photo.png", "image/png",
                new byte[] {1, 2, 3});
        assertThrows(ResponseStatusException.class, () ->
                controller.uploadItem(2L, file, login("stranger@bmsce.ac.in")));
    }
}
