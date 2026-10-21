package com.campusconnect.api;

import com.campusconnect.model.ItemClaim;
import com.campusconnect.model.LostItem;
import com.campusconnect.repo.ItemClaimRepository;
import com.campusconnect.repo.LostItemRepository;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {
    private final LostItemRepository items;
    private final ItemClaimRepository claims;

    public AdminAnalyticsController(LostItemRepository items, ItemClaimRepository claims) {
        this.items = items;
        this.claims = claims;
    }

    @GetMapping
    public Map<String, Long> overview() {
        List<LostItem> reports = items.findAll();
        List<ItemClaim> requests = claims.findAll();
        return Map.of(
                "totalReports", (long) reports.size(),
                "lostReports", reports.stream().filter(i -> "LOST".equals(i.kind)).count(),
                "foundReports", reports.stream().filter(i -> "FOUND".equals(i.kind)).count(),
                "unresolvedReports", reports.stream().filter(i -> "OPEN".equals(i.status)).count(),
                "inCustody", reports.stream().filter(i ->
                        i.custodyAcceptedAt != null && "OPEN".equals(i.status)).count(),
                "totalClaims", (long) requests.size(),
                "pendingClaims", requests.stream().filter(c -> "PENDING".equals(c.status)).count(),
                "completedHandovers", requests.stream().filter(c -> "HANDED_OVER".equals(c.status)).count());
    }
}
