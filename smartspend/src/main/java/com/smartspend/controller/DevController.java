package com.smartspend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.smartspend.model.User;
import com.smartspend.service.AuthService;
import com.smartspend.dto.AuthResponse;

@RestController
@RequestMapping("/api/dev")
public class DevController {

    private final AuthService authService;

    public DevController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/create-mock-user")
    public ResponseEntity<AuthResponse> createMockUser() {
        try {
            // Create or get mock user
            User mockUser = User.builder()
                    .id(123L) // Use Long type
                    .name("Test User")
                    .email("test@demo.com")
                    .password("$2a$10$Vt2p8rK5qG5X6YqQ5v5X5L5qG5X6YqQ5v5X5L5qG5X6YqQ5v5X5") // BCrypt encoded "password123"
                    .currency("INR")
                    .emailVerified(true) // Pre-verified for testing
                    .build();

            // Save to database
            authService.registerUser(mockUser);
            
            // Generate token
            String token = authService.generateTokenForUser(mockUser);
            
            AuthResponse.UserDto userDto = AuthResponse.UserDto.builder()
                    .id(mockUser.getId().toString())
                    .name(mockUser.getName())
                    .email(mockUser.getEmail())
                    .currency(mockUser.getCurrency())
                    .emailVerified(mockUser.isEmailVerified())
                    .build();
            
            AuthResponse response = AuthResponse.builder()
                    .token(token)
                    .user(userDto)
                    .message("Mock user created successfully!")
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
