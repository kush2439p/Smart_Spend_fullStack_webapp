package com.smartspend.controller;

import com.smartspend.dto.RecurringRequest;
import com.smartspend.dto.RecurringResponse;
import com.smartspend.service.RecurringService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recurring")
@RequiredArgsConstructor
public class RecurringController {

    private final RecurringService recurringService;

    @GetMapping
    public ResponseEntity<List<RecurringResponse>> getAllRecurring() {
        return ResponseEntity.ok(recurringService.getAllRecurring());
    }

    @PostMapping
    public ResponseEntity<RecurringResponse> createRecurring(@Valid @RequestBody RecurringRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(recurringService.createRecurring(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RecurringResponse> updateRecurring(
            @PathVariable Long id,
            @Valid @RequestBody RecurringRequest request) {
        return ResponseEntity.ok(recurringService.updateRecurring(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecurring(@PathVariable Long id) {
        recurringService.deleteRecurring(id);
        return ResponseEntity.noContent().build();
    }
}
