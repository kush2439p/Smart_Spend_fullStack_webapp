package com.smartspend.service;

import com.smartspend.dto.DashboardResponse;
import com.smartspend.dto.TransactionResponse;
import com.smartspend.model.Category;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final TransactionService transactionService;
    private final BudgetService budgetService;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public DashboardResponse getSummary() {
        User user = getCurrentUser();
        int currentMonth = LocalDate.now().getMonthValue();
        int currentYear = LocalDate.now().getYear();

        BigDecimal totalIncome = transactionRepository.sumAmountByUserAndType(user, Transaction.TransactionType.INCOME);
        BigDecimal totalExpense = transactionRepository.sumAmountByUserAndType(user, Transaction.TransactionType.EXPENSE);
        BigDecimal totalBalance = totalIncome.subtract(totalExpense);

        BigDecimal monthlyIncome = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(
                user, Transaction.TransactionType.INCOME, currentMonth, currentYear);
        BigDecimal monthlyExpense = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(
                user, Transaction.TransactionType.EXPENSE, currentMonth, currentYear);
        BigDecimal monthlySaved = monthlyIncome.subtract(monthlyExpense);

        List<TransactionResponse> recentTransactions = transactionRepository
                .findTopByUser(user, PageRequest.of(0, 5))
                .stream()
                .map(transactionService::toResponse)
                .collect(Collectors.toList());

        // Top 3 categories by spending this month
        List<Object[]> rawTop = transactionRepository.findTopCategoriesBySpending(user, currentMonth, currentYear);
        BigDecimal totalMonthlySpend = monthlyExpense.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ONE : monthlyExpense;

        List<DashboardResponse.TopCategory> topCategories = rawTop.stream()
                .limit(3)
                .map(row -> {
                    Category cat = (Category) row[0];
                    BigDecimal amount = (BigDecimal) row[1];
                    double pct = amount.divide(totalMonthlySpend, 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(100)).doubleValue();
                    return DashboardResponse.TopCategory.builder()
                            .categoryName(cat.getName())
                            .color(cat.getColor())
                            .icon(cat.getIcon())
                            .totalAmount(amount)
                            .percentage(pct)
                            .build();
                })
                .collect(Collectors.toList());

        // Budget alerts (>= 80%)
        var budgetAlerts = budgetService.getBudgetsOverThreshold(user, currentMonth, currentYear, 80.0);

        // 7-day spending trend (expense totals per weekday)
        var spendingTrend = getSpendingTrendLast7Days(user);

        return DashboardResponse.builder()
                .totalBalance(totalBalance)
                .monthlyIncome(monthlyIncome)
                .monthlyExpense(monthlyExpense)
                .monthlySaved(monthlySaved)
                .recentTransactions(recentTransactions)
                .topCategories(topCategories)
                .budgetAlerts(budgetAlerts)
                .spendingTrend(spendingTrend)
                .build();
    }

    public List<DashboardResponse.DailyTotal> getDailyAnalytics(int month, int year) {
        User user = getCurrentUser();
        List<Object[]> rows = transactionRepository.findDailyTotals(user, month, year);

        return rows.stream().map(row -> DashboardResponse.DailyTotal.builder()
                .date(row[0].toString())
                .expense((BigDecimal) row[1])
                .income((BigDecimal) row[2])
                .build()
        ).collect(Collectors.toList());
    }

    public List<DashboardResponse.CategoryBreakdown> getCategoryBreakdown(int month, int year) {
        User user = getCurrentUser();
        List<Object[]> rows = transactionRepository.findTopCategoriesBySpending(user, month, year);

        BigDecimal total = rows.stream()
                .map(r -> (BigDecimal) r[1])
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal divisor = total.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ONE : total;

        return rows.stream().map(row -> {
            Category cat = (Category) row[0];
            BigDecimal amount = (BigDecimal) row[1];
            double pct = amount.divide(divisor, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
            return DashboardResponse.CategoryBreakdown.builder()
                    .category(cat.getName())
                    .icon(cat.getIcon())
                    .color(cat.getColor())
                    .amount(amount)
                    .percentage(pct)
                    .build();
        }).collect(Collectors.toList());
    }

    public List<DashboardResponse.MonthlyTotal> getMonthlyAnalytics(int year) {
        User user = getCurrentUser();
        List<Object[]> rows = transactionRepository.findMonthlyTotals(user, year);

        // Fill all 12 months including those with no data
        List<DashboardResponse.MonthlyTotal> result = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            final int month = m;
            DashboardResponse.MonthlyTotal mt = rows.stream()
                    .filter(r -> ((Number) r[0]).intValue() == month)
                    .findFirst()
                    .map(r -> DashboardResponse.MonthlyTotal.builder()
                            .month(java.time.Month.of(month).getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                            .income((BigDecimal) r[1])
                            .expense((BigDecimal) r[2])
                            .build())
                    .orElse(DashboardResponse.MonthlyTotal.builder()
                            .month(java.time.Month.of(month).getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                            .income(BigDecimal.ZERO)
                            .expense(BigDecimal.ZERO)
                            .build());
            result.add(mt);
        }
        return result;
    }

    /**
     * Returns the last 6 months of income vs expense up to "now".
     * Frontend expects this to power the "monthly comparison" chart.
     */
    public List<DashboardResponse.MonthlyTotal> getMonthlyComparison() {
        User user = getCurrentUser();
        LocalDate now = LocalDate.now();

        List<DashboardResponse.MonthlyTotal> result = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate d = now.minusMonths(i);
            int month = d.getMonthValue();
            int year = d.getYear();

            BigDecimal income = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(
                    user, Transaction.TransactionType.INCOME, month, year);
            BigDecimal expense = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(
                    user, Transaction.TransactionType.EXPENSE, month, year);

            result.add(DashboardResponse.MonthlyTotal.builder()
                    .month(d.getMonth().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .income(income)
                    .expense(expense)
                    .build());
        }
        return result;
    }

    private List<DashboardResponse.SpendingTrend> getSpendingTrendLast7Days(User user) {
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(6);

        List<Transaction> txs = transactionRepository.findByUserAndDateBetweenList(user, start, end);
        Map<LocalDate, BigDecimal> expenseByDate = new HashMap<>();

        for (Transaction tx : txs) {
            if (tx.getType() == Transaction.TransactionType.EXPENSE) {
                expenseByDate.merge(tx.getDate(), tx.getAmount(), BigDecimal::add);
            }
        }

        List<DashboardResponse.SpendingTrend> trend = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            LocalDate d = start.plusDays(i);
            BigDecimal amount = expenseByDate.getOrDefault(d, BigDecimal.ZERO);
            trend.add(DashboardResponse.SpendingTrend.builder()
                    .date(d.getDayOfWeek().getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
                    .amount(amount)
                    .build());
        }

        return trend;
    }
}
