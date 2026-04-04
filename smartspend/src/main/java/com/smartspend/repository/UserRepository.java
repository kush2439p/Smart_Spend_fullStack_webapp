package com.smartspend.repository;

import com.smartspend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByVerificationToken(String token);
    Optional<User> findByResetToken(String resetToken);

    boolean existsByEmail(String email);
}
