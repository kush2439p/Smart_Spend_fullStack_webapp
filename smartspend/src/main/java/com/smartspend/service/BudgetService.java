package com.smartspend.service;

import com.smartspend.dto.BudgetRequest;
import com.smartspend.dto.BudgetResponse;
import com.smartspend.exception.ResourceNotFoundException;
import com.smartspend.model.BudgetGoal;
import com.smartspend.model.Category;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import com.smartspend.repository.BudgetGoalRepository;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetGoalRepository budgetGoalRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final CategoryService categoryService;
    private final EmailService emailService;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<BudgetResponse> getAllBudgets() {
        // The frontend budgets screen expects current-month spent + percentage.
        // We compute that in getBudgetStatus().
        return getBudgetStatus();
    }

    @Transactional
    public BudgetResponse createBudget(BudgetRequest request) {
        User user = getCurrentUser();
        Category category = categoryService.findByIdAndUser(request.getCategoryId(), user);

        int month = request.getMonth() != null ? request.getMonth() : LocalDate.now().getMonthValue();
        int year = request.getYear() != null ? request.getYear() : LocalDate.now().getYear();

        BudgetGoal budget = BudgetGoal.builder()
                .user(user)
                .category(category)
                .limitAmount(request.getLimitAmount())
                .month(month)
                .year(year)
                .build();

        return toResponse(budgetGoalRepository.save(budget), false);
    }

    @Transactional
    public BudgetResponse updateBudget(Long id, BudgetRequest request) {
        User user = getCurrentUser();
        BudgetGoal budget = budgetGoalRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Budget", id));

        Category category = categoryService.findByIdAndUser(request.getCategoryId(), user);

        budget.setCategory(category);
        budget.setLimitAmount(request.getLimitAmount());
        if (request.getMonth() != null) budget.setMonth(request.getMonth());
        if (request.getYear() != null) budget.setYear(request.getYear());

        return toResponse(budgetGoalRepository.save(budget), false);
    }

    @Transactional
    public void deleteBudget(Long id) {
        User user = getCurrentUser();
        BudgetGoal budget = budgetGoalRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Budget", id));
        budgetGoalRepository.delete(budget);
    }

    public List<BudgetResponse> getBudgetStatus() {
        User user = getCurrentUser();
        int currentMonth = LocalDate.now().getMonthValue();
        int currentYear = LocalDate.now().getYear();

        return budgetGoalRepository.findByUserAndMonthAndYear(user, currentMonth, currentYear).stream()
                .map(b -> {
                    BigDecimal spent = transactionRepository.sumExpenseByUserAndCategoryAndMonthAndYear(
                            user, b.getCategory(), currentMonth, currentYear);
                    double percentage = b.getLimitAmount().compareTo(BigDecimal.ZERO) > 0
                            ? spent.divide(b.getLimitAmount(), 4, RoundingMode.HALF_UP)
                              .multiply(BigDecimal.valueOf(100)).doubleValue()
                            : 0.0;

                    if (percentage >= 80) {
                        try {
                            emailService.sendBudgetAlertEmail(
                                    user.getEmail(),
                                    user.getName(),
                                    b.getCategory().getName(),
                                    percentage,
                                    spent.toPlainString(),
                                    b.getLimitAmount().toPlainString()
                            );
                        } catch (Exception e) {
                            // log but don't fail the request
                        }
                    }

                    return BudgetResponse.builder()
                            .id(b.getId() != null ? b.getId().toString() : null)
                            .categoryId(b.getCategory().getId() != null ? b.getCategory().getId().toString() : null)
                            .categoryName(b.getCategory().getName())
                            .categoryColor(b.getCategory().getColor())
                            .categoryIcon(b.getCategory().getIcon())
                            .limitAmount(b.getLimitAmount())
                            .spentAmount(spent)
                            .percentage(Math.min(percentage, 100.0))
                            .isOverBudget(percentage > 100)
                            .month(b.getMonth())
                            .year(b.getYear())
                            .createdAt(b.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private BudgetResponse toResponse(BudgetGoal b, boolean withSpending) {
        return BudgetResponse.builder()
                .id(b.getId() != null ? b.getId().toString() : null)
                .categoryId(b.getCategory().getId() != null ? b.getCategory().getId().toString() : null)
                .categoryName(b.getCategory().getName())
                .categoryColor(b.getCategory().getColor())
                .categoryIcon(b.getCategory().getIcon())
                .limitAmount(b.getLimitAmount())
                .spentAmount(BigDecimal.ZERO)
                .percentage(0.0)
                .isOverBudget(false)
                .month(b.getMonth())
                .year(b.getYear())
                .createdAt(b.getCreatedAt())
                .build();
    }

    public List<BudgetResponse> getBudgetsOverThreshold(User user, int month, int year, double threshold) {
        return budgetGoalRepository.findByUserAndMonthAndYear(user, month, year).stream()
                .map(b -> {
                    BigDecimal spent = transactionRepository.sumExpenseByUserAndCategoryAndMonthAndYear(
                            user, b.getCategory(), month, year);
                    double percentage = b.getLimitAmount().compareTo(BigDecimal.ZERO) > 0
                            ? spent.divide(b.getLimitAmount(), 4, RoundingMode.HALF_UP)
                              .multiply(BigDecimal.valueOf(100)).doubleValue()
                            : 0.0;
                    return BudgetResponse.builder()
                            .id(b.getId() != null ? b.getId().toString() : null)
                            .categoryId(b.getCategory().getId() != null ? b.getCategory().getId().toString() : null)
                            .categoryName(b.getCategory().getName())
                            .categoryColor(b.getCategory().getColor())
                            .categoryIcon(b.getCategory().getIcon())
                            .limitAmount(b.getLimitAmount())
                            .spentAmount(spent)
                            .percentage(Math.min(percentage, 100.0))
                            .isOverBudget(percentage > 100)
                            .month(b.getMonth())
                            .year(b.getYear())
                            .createdAt(b.getCreatedAt())
                            .build();
                })
                .filter(br -> br.getPercentage() >= threshold)
                .collect(Collectors.toList());
    }
}
