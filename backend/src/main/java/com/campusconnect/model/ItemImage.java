package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "item_images")
public class ItemImage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "item_id", nullable = false)
    public LostItem item;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "claim_id")
    public ItemClaim claim;
    @Column(nullable = false)
    public String uploadedBy;
    @Column(nullable = false)
    public String contentType;
    @Lob @Column(nullable = false, columnDefinition = "LONGBLOB")
    public byte[] data;
    public Instant createdAt = Instant.now();
}
