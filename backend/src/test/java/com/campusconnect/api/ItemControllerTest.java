package com.campusconnect.api;

import com.campusconnect.model.LostItem;
import com.campusconnect.repo.LostItemRepository;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.ClaimDisputeRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemControllerTest {
    private final LostItemRepository repository = mock(LostItemRepository.class);
    private final ItemClaimRepository claims = mock(ItemClaimRepository.class);
    private final ClaimDisputeRepository disputes = mock(ClaimDisputeRepository.class);
    private final ItemController controller = new ItemController(repository, claims, disputes);
    private final UsernamePasswordAuthenticationToken student =
            new UsernamePasswordAuthenticationToken("student@bmsce.ac.in", "unused");

    private final UsernamePasswordAuthenticationToken staff =
            new UsernamePasswordAuthenticationToken("staff@bmsce.ac.in", "unused",
                    java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_STAFF")));

    @Test
    void staffCannotBypassVerifiedHandoverForRecoveredLostItemInCustody() {
        LostItem item = new LostItem();
        item.kind = "LOST";
        item.status = "OPEN";
        item.custodyAcceptedAt = java.time.Instant.now();
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        var error = assertThrows(ResponseStatusException.class, () -> controller.close(1L, staff));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(repository, never()).save(any());
    }

    @Test
    void publicListingDoesNotExposeStaffStorageLocation() {
        LostItem item = new LostItem();
        item.id = 1L;
        item.title = "Wallet";
        item.custodyLocation = "Secure locker 3";
        when(repository.findAll()).thenReturn(java.util.List.of(item));
        var publicItems = controller.all();
        assertEquals(1, publicItems.size());
        assertEquals("Wallet", publicItems.get(0).title());
        assertFalse(java.util.Arrays.stream(ItemController.PublicItem.class.getRecordComponents())
                .anyMatch(component -> component.getName().equals("custodyLocation")));
    }

    @Test
    void cannotSpoofPosterOrStatus() {
        when(repository.save(any(LostItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var result = controller.create(
                new ItemController.ItemRequest("Wallet", "Black wallet", "Library", "Other", "FOUND"),
                student);
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("student@bmsce.ac.in", result.getBody().postedBy());
        assertEquals("OPEN", result.getBody().status());
    }

    @Test
    void rejectsInvalidKind() {
        assertThrows(ResponseStatusException.class, () ->
                controller.create(new ItemController.ItemRequest(
                        "Wallet", "", "", "", "APPROVED"), student));
        verifyNoInteractions(repository);
    }

    @Test
    void staffCannotCloseWhileClaimIsPending() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        item.status = "OPEN";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        when(claims.existsByItemIdAndStatusIn(eq(1L), anyList())).thenReturn(true);
        assertThrows(ResponseStatusException.class, () -> controller.close(1L, staff));
        verify(repository, never()).save(any());
    }

    @Test
    void staffCannotCloseWhileOwnershipAppealIsOpen() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        item.status = "OPEN";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        when(disputes.existsOpenForItem(1L, "OPEN")).thenReturn(true);
        assertThrows(ResponseStatusException.class, () -> controller.close(1L, staff));
        verify(repository, never()).save(any());
    }

    @Test
    void cannotCloseAnAlreadyResolvedItem() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        item.status = "RESOLVED";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.close(1L, staff));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verify(repository, never()).save(any());
    }

    @Test
    void staffCanCloseItem() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        item.status = "OPEN";
        when(repository.save(item)).thenReturn(item);
        var result = controller.close(1L, staff);
        assertEquals("RESOLVED", result.getBody().status());
    }

    @Test
    void reportOwnerCannotCloseItem() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.close(1L, student));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
        verify(repository, never()).save(any());
    }
}
