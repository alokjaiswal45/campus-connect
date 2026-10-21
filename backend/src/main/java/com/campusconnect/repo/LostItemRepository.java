package com.campusconnect.repo;

import com.campusconnect.model.LostItem;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LostItemRepository extends JpaRepository<LostItem, Long> {
    // Serialize claim approval, submission and handover on one item row.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from LostItem i where i.id = :id")
    Optional<LostItem> lockById(@Param("id") Long id);
}
