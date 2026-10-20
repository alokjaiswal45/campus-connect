package com.campusconnect.model;
import jakarta.persistence.*;
@Entity public class Subject {@Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;@ManyToOne(optional=false) public Branch branch;public int semester;@Column(nullable=false) public String code;@Column(nullable=false) public String name;public Subject(){} }
