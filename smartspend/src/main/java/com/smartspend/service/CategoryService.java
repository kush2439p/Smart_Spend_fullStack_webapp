package com.smartspend.service;

import com.smartspend.dto.CategoryRequest;
import com.smartspend.dto.CategoryResponse;
import com.smartspend.exception.ResourceNotFoundException;
import com.smartspend.model.Category;
import com.smartspend.model.User;
import com.smartspend.repository.CategoryRepository;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<CategoryResponse> getAllCategories() {
        User user = getCurrentUser();
        return categoryRepository.findByUser(user).stream()
                .map(c -> toResponse(c, user))
                .collect(Collectors.toList());
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest request) {
        User user = getCurrentUser();

        Category category = Category.builder()
                .user(user)
                .name(request.getName())
                .type(request.getType())
                .color(request.getColor() != null ? request.getColor() : "#6b7280")
                .icon(request.getIcon() != null ? request.getIcon() : "📁")
                .isDefault(false)
                .build();

        return toResponse(categoryRepository.save(category), user);
    }

    @Transactional
    public CategoryResponse updateCategory(Long id, CategoryRequest request) {
        User user = getCurrentUser();

        Category category = categoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));

        if (category.isDefault()) {
            throw new RuntimeException("Default categories cannot be modified.");
        }

        category.setName(request.getName());
        category.setType(request.getType());
        if (request.getColor() != null) category.setColor(request.getColor());
        if (request.getIcon() != null) category.setIcon(request.getIcon());

        return toResponse(categoryRepository.save(category), user);
    }

    @Transactional
    public void deleteCategory(Long id) {
        User user = getCurrentUser();

        Category category = categoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));

        if (category.isDefault()) {
            throw new RuntimeException("Default categories cannot be deleted.");
        }

        categoryRepository.delete(category);
    }

    @Transactional
    public void seedDefaultCategories(User user) {
        // EXPENSE defaults
        createDefault(user, "Food", Category.CategoryType.EXPENSE, "#ef4444", "🍔");
        createDefault(user, "Transport", Category.CategoryType.EXPENSE, "#f97316", "🚗");
        createDefault(user, "Shopping", Category.CategoryType.EXPENSE, "#eab308", "🛍️");
        createDefault(user, "Entertainment", Category.CategoryType.EXPENSE, "#a855f7", "🎬");
        createDefault(user, "Health", Category.CategoryType.EXPENSE, "#22c55e", "🏥");
        createDefault(user, "Bills", Category.CategoryType.EXPENSE, "#3b82f6", "📄");
        createDefault(user, "Education", Category.CategoryType.EXPENSE, "#06b6d4", "📚");
        createDefault(user, "Travel", Category.CategoryType.EXPENSE, "#84cc16", "✈️");
        createDefault(user, "Other", Category.CategoryType.EXPENSE, "#6b7280", "📦");

        // INCOME defaults
        createDefault(user, "Salary", Category.CategoryType.INCOME, "#22c55e", "💼");
        createDefault(user, "Freelance", Category.CategoryType.INCOME, "#10b981", "💻");
        createDefault(user, "Investment", Category.CategoryType.INCOME, "#059669", "📈");
        createDefault(user, "Gift", Category.CategoryType.INCOME, "#ec4899", "🎁");
        createDefault(user, "Other Income", Category.CategoryType.INCOME, "#6b7280", "💰");
    }

    private void createDefault(User user, String name, Category.CategoryType type, String color, String icon) {
        Category category = Category.builder()
                .user(user)
                .name(name)
                .type(type)
                .color(color)
                .icon(icon)
                .isDefault(true)
                .build();
        categoryRepository.save(category);
    }

    public CategoryResponse toResponse(Category category, User user) {
        int currentMonth = LocalDate.now().getMonthValue();
        int currentYear = LocalDate.now().getYear();

        // Category.type only has INCOME/EXPENSE, so we map directly to TransactionType.
        com.smartspend.model.Transaction.TransactionType txType =
                category.getType() == Category.CategoryType.INCOME
                        ? com.smartspend.model.Transaction.TransactionType.INCOME
                        : com.smartspend.model.Transaction.TransactionType.EXPENSE;

        Long count = transactionRepository.countByUserAndCategoryAndTypeAndMonthAndYear(
                user, category, txType, currentMonth, currentYear);
        BigDecimal monthlySum = transactionRepository.sumAmountByUserAndCategoryAndTypeAndMonthAndYear(
                user, category, txType, currentMonth, currentYear);

        return CategoryResponse.builder()
                .id(category.getId() != null ? category.getId().toString() : null)
                .name(category.getName())
                .type(category.getType() != null ? category.getType().name().toLowerCase() : null)
                .color(category.getColor())
                .icon(category.getIcon())
                .transactionCount(count != null ? count.intValue() : 0)
                .monthlyTotal(monthlySum != null ? monthlySum.doubleValue() : 0.0)
                .build();
    }

    public Category findByIdAndUser(Long id, User user) {
        return categoryRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Category", id));
    }

    public Category findByNameAndUser(String name, User user) {
        // 1. Exact match
        Category exact = categoryRepository.findByUserAndName(user, name).orElse(null);
        if (exact != null) return exact;
        // 2. Case-insensitive match
        return categoryRepository.findByUserAndNameIgnoreCase(user, name).orElse(null);
    }

    @Transactional
    public Category findOrCreateByName(String name, User user) {
        if (name == null || name.isBlank()) name = "Other";
        Category found = findByNameAndUser(name, user);
        if (found != null) return found;
        // Try "Other" as final fallback before creating
        if (!"Other".equalsIgnoreCase(name)) {
            Category other = findByNameAndUser("Other", user);
            if (other != null) return other;
        }
        // Auto-create the category so the save succeeds
        Category newCat = Category.builder()
                .user(user)
                .name(name)
                .type(Category.CategoryType.EXPENSE)
                .color("#6b7280")
                .icon("📁")
                .isDefault(false)
                .build();
        return categoryRepository.save(newCat);
    }
}
