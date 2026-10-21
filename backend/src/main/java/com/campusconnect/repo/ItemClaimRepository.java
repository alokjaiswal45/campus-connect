package com.campusconnect.repo;

import com.campusconnect.model.ItemClaim;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemClaimRepository extends JpaRepository<ItemClaim, Long> {
    List<ItemClaim> findByClaimantEmailIgnoreCaseOrderByCreatedAtDesc(String email);
    List<ItemClaim> findByItemIdOrderByCreatedAtDesc(Long itemId);
    boolean existsByItemIdAndClaimantEmailIgnoreCase(Long itemId, String email);
    boolean existsByItemIdAndStatusIn(Long itemId, List<String> statuses);
}
