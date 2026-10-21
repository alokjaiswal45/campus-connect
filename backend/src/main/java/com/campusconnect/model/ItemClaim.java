package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "item_claims", indexes = @Index(name = "idx_claim_item", columnList = "item_id"))
public class ItemClaim {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "item_id", nullable = false)
    public LostItem item;
    @Column(nullable = false)
    public String claimantEmail;
    @Column(nullable = false, length = 2000)
    public String ownershipAnswer;
    @Column(nullable = false)
    public String status = "PENDING";
    public Instant createdAt = Instant.now();
    public Instant reviewedAt;
    public String reviewedBy;
    public String pickupReference;
    public Instant handedOverAt;
    public String handedOverBy;
}
