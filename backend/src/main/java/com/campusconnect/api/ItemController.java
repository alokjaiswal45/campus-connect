package com.campusconnect.api;
import com.campusconnect.model.LostItem;import com.campusconnect.repo.LostItemRepository;import org.springframework.security.core.Authentication;import org.springframework.web.bind.annotation.*;import org.springframework.http.*;import java.util.*;
@RestController @RequestMapping("/api/items") public class ItemController {private final LostItemRepository repo;public ItemController(LostItemRepository r){repo=r;}
@GetMapping public Object all(){return repo.findAll();}
@PostMapping public Object create(@RequestBody LostItem item,Authentication auth){item.id=null;item.postedBy=auth.getName();item.status="OPEN";item.createdAt=java.time.Instant.now();return repo.save(item);}
@PutMapping("/{id}/close") public ResponseEntity<?> close(@PathVariable Long id,Authentication auth){LostItem item=repo.findById(id).orElseThrow();if(!item.postedBy.equals(auth.getName())&&auth.getAuthorities().stream().noneMatch(a->a.getAuthority().equals("ROLE_ADMIN")))return ResponseEntity.status(403).build();item.status="RESOLVED";return ResponseEntity.ok(repo.save(item));}
}
