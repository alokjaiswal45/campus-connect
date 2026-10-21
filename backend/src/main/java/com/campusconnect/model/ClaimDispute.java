package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "claim_disputes", indexes = @Index(name = "idx_dispute_claim", columnList = "claim_id"))
public class ClaimDispute {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "claim_id", nullable = false)
    public ItemClaim claim;
    @Column(nullable = false)
    public String openedBy;
    @Column(nullable = false, length = 2000)
    public String reason;
    @Column(nullable = false)
    public String status = "OPEN";
    public Instant createdAt = Instant.now();
    public Instant resolvedAt;
    public String resolvedBy;
    @Column(length = 2000)
    public String resolution;
}
