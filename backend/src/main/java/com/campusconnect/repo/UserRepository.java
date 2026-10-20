
package com.campusconnect.repo;

import com.campusconnect.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // Find a user by email, ignoring uppercase/lowercase differences.
    Optional<User> findByEmailIgnoreCase(String email);

}
