package com.smartspend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BudgetResponse {

    private String id;
    private String categoryId;
    private String categoryName;
    private String categoryColor;
    private String categoryIcon;
    private BigDecimal limitAmount;
    private BigDecimal spentAmount;
    private double percentage;
    private boolean isOverBudget;
    private int month;
    private int year;

    // Used by backend when returning budget status; safe for frontend consumers.
    private LocalDateTime createdAt;
}
