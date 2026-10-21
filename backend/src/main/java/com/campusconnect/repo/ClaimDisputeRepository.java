package com.campusconnect.repo;

import com.campusconnect.model.ClaimDispute;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClaimDisputeRepository extends JpaRepository<ClaimDispute, Long> {
    List<ClaimDispute> findByOpenedByIgnoreCaseOrderByCreatedAtDesc(String email);
    List<ClaimDispute> findByStatusOrderByCreatedAtAsc(String status);
    boolean existsByClaimIdAndStatus(Long claimId, String status);
}
