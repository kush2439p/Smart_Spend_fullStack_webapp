package com.smartspend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.smartspend.repository.UserRepository;
import com.smartspend.model.User;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/dev")
public class DevController {

    private final UserRepository userRepository;

    public DevController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestParam String email) {
        Optional<User> userOpt = userRepository.findByEmail(email.toLowerCase().trim());
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No account found with email: " + email));
        }
        User user = userOpt.get();
        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setVerificationTokenExpiry(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of(
            "message", "Email verified successfully! You can now log in.",
            "email", user.getEmail()
        ));
    }
}
