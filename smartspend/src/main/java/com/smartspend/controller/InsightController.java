package com.smartspend.controller;

import com.smartspend.dto.InsightResponse;
import com.smartspend.service.InsightService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/insights")
@RequiredArgsConstructor
public class InsightController {

    private final InsightService insightService;

    @GetMapping
    public ResponseEntity<InsightResponse> getInsights() {
        return ResponseEntity.ok(insightService.getInsights());
    }
}
