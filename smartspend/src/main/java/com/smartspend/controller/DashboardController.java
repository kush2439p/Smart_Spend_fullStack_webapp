package com.smartspend.controller;

import com.smartspend.dto.DashboardResponse;
import com.smartspend.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/api/dashboard/summary")
    public ResponseEntity<DashboardResponse> getSummary() {
        return ResponseEntity.ok(dashboardService.getSummary());
    }

    @GetMapping("/api/analytics/daily")
    public ResponseEntity<List<DashboardResponse.DailyTotal>> getDailyAnalytics(
            @RequestParam(defaultValue = "0") int month,
            @RequestParam(defaultValue = "0") int year) {

        int m = month > 0 ? month : LocalDate.now().getMonthValue();
        int y = year > 0 ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(dashboardService.getDailyAnalytics(m, y));
    }

    @GetMapping("/api/analytics/category-breakdown")
    public ResponseEntity<List<DashboardResponse.CategoryBreakdown>> getCategoryBreakdown(
            @RequestParam(defaultValue = "0") int month,
            @RequestParam(defaultValue = "0") int year) {

        int m = month > 0 ? month : LocalDate.now().getMonthValue();
        int y = year > 0 ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(dashboardService.getCategoryBreakdown(m, y));
    }

    @GetMapping("/api/analytics/monthly")
    public ResponseEntity<List<DashboardResponse.MonthlyTotal>> getMonthlyAnalytics(
            @RequestParam(defaultValue = "0") int year) {

        int y = year > 0 ? year : LocalDate.now().getYear();
        return ResponseEntity.ok(dashboardService.getMonthlyAnalytics(y));
    }

    // Frontend alias used by analytics screen
    @GetMapping("/api/analytics/monthly-comparison")
    public ResponseEntity<List<DashboardResponse.MonthlyTotal>> getMonthlyComparison() {
        return ResponseEntity.ok(dashboardService.getMonthlyComparison());
    }
}
