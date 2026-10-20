package com.campusconnect.repo;
import com.campusconnect.model.LostItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LostItemRepository extends JpaRepository<LostItem,Long> {}
