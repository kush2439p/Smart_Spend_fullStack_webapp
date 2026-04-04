package com.smartspend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResponse {

    private BigDecimal totalBalance;
    private BigDecimal monthlyIncome;
    private BigDecimal monthlyExpense;
    private BigDecimal monthlySaved;
    private List<TransactionResponse> recentTransactions;
    private List<TopCategory> topCategories;
    private List<BudgetResponse> budgetAlerts;
    // Used by the frontend's "7-Day Trend" mini chart
    private List<SpendingTrend> spendingTrend;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopCategory {
        private String categoryName;
        private String color;
        private String icon;
        private BigDecimal totalAmount;
        private double percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyTotal {
        private String date;
        private BigDecimal expense;
        private BigDecimal income;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyTotal {
        private String month;
        private BigDecimal income;
        private BigDecimal expense;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CategoryBreakdown {
        private String icon;
        private String category;
        private String color;
        private BigDecimal amount;
        private double percentage;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpendingTrend {
        private String date;
        private BigDecimal amount;
    }
}
