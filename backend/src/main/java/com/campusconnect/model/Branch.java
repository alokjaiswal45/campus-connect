package com.campusconnect.model;
import jakarta.persistence.*;
@Entity public class Branch {@Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;@Column(nullable=false,unique=true) public String code;@Column(nullable=false) public String name;public Branch(){} }
