package com.campusconnect.api;

import com.campusconnect.model.LostItem;
import com.campusconnect.repo.LostItemRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ItemControllerTest {
    private final LostItemRepository repository = mock(LostItemRepository.class);
    private final ItemController controller = new ItemController(repository);
    private final UsernamePasswordAuthenticationToken student =
            new UsernamePasswordAuthenticationToken("student@bmsce.ac.in", "unused");

    @Test
    void cannotSpoofPosterOrStatus() {
        when(repository.save(any(LostItem.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var result = controller.create(
                new ItemController.ItemRequest("Wallet", "Black wallet", "Library", "Other", "FOUND"),
                student);
        assertEquals(HttpStatus.CREATED, result.getStatusCode());
        assertEquals("student@bmsce.ac.in", result.getBody().postedBy);
        assertEquals("OPEN", result.getBody().status);
    }

    @Test
    void rejectsInvalidKind() {
        assertThrows(ResponseStatusException.class, () ->
                controller.create(new ItemController.ItemRequest(
                        "Wallet", "", "", "", "APPROVED"), student));
        verifyNoInteractions(repository);
    }

    @Test
    void ownerCanCloseItem() {
        LostItem item = new LostItem();
        item.postedBy = "student@bmsce.ac.in";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        when(repository.save(item)).thenReturn(item);
        var result = controller.close(1L, student);
        assertEquals("RESOLVED", result.getBody().status);
    }

    @Test
    void unrelatedStudentCannotCloseItem() {
        LostItem item = new LostItem();
        item.postedBy = "someone@bmsce.ac.in";
        when(repository.lockById(1L)).thenReturn(Optional.of(item));
        assertThrows(ResponseStatusException.class, () -> controller.close(1L, student));
        verify(repository, never()).save(any());
    }
}
