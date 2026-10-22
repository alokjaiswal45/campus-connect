package com.campusconnect.model;

import jakarta.persistence.*;

@Entity
@Table(name = "account_profiles")
public class AccountProfile {
    @Id public Long userId;
    @Column(length = 120) public String department;
    @Column(length = 500) public String about;
    @Lob @Column(columnDefinition = "MEDIUMBLOB") public byte[] photo;
}
