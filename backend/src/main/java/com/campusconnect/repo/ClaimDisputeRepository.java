package com.campusconnect.repo;

import com.campusconnect.model.ClaimDispute;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClaimDisputeRepository extends JpaRepository<ClaimDispute, Long> {
    List<ClaimDispute> findByOpenedByIgnoreCaseOrderByCreatedAtDesc(String email);
    List<ClaimDispute> findByStatusOrderByCreatedAtAsc(String status);
    boolean existsByClaimIdAndStatus(Long claimId, String status);
    @Query("select (count(d) > 0) from ClaimDispute d where d.claim.item.id = :itemId and d.status = :status")
    boolean existsOpenForItem(@Param("itemId") Long itemId, @Param("status") String status);
}
