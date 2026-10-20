
package com.campusconnect.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "academic_documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @ManyToOne(optional = false)
    public Subject subject;

    @Column(nullable = false)
    public String title;

    @Column(nullable = false)
    public String type;

    // Study Resources: Module 1 to Module 5
    // Null for Question Papers
    @Column(name = "module_number")
    public Integer moduleNumber;

    // Question Papers:
    // CIE 1, CIE 2, CIE 3, SEE, SUPPLEMENTARY
    // Null for Study Resources
    public String examType;

    // Question Paper year, for example: 2023, 2024, 2025
    // Null for Study Resources
    public String academicYear;

    @Column(nullable = false)
    public String storageName;

    @Column(nullable = false)
    public String originalName;

    public Instant createdAt = Instant.now();

    public Document() {
    }
}
