package com.campusconnect.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity public class LostItem {@Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;@Column(nullable=false) public String title;@Column(length=3000) public String description;public String location;public String category;public String kind;public String status="OPEN";public String postedBy;public Instant createdAt=Instant.now();public LostItem(){} }
