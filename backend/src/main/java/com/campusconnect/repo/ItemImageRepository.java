package com.campusconnect.repo;

import com.campusconnect.model.ItemImage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemImageRepository extends JpaRepository<ItemImage, Long> {
    List<ItemImage> findByItemIdAndClaimIsNullOrderByCreatedAtAsc(Long itemId);
    List<ItemImage> findByClaimIdOrderByCreatedAtAsc(Long claimId);
}
