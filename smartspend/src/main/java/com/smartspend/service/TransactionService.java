package com.smartspend.service;

import com.smartspend.dto.TransactionRequest;
import com.smartspend.dto.TransactionResponse;
import com.smartspend.exception.ResourceNotFoundException;
import com.smartspend.model.*;
import com.smartspend.repository.AuditLogRepository;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final CategoryService categoryService;
    private final AuditLogRepository auditLogRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public Page<TransactionResponse> getAllTransactions(
            Transaction.TransactionType type,
            Long categoryId,
            String category,
            LocalDate startDate,
            LocalDate endDate,
            int page,
            int size) {

        User user = getCurrentUser();
        Pageable pageable = PageRequest.of(page, size, Sort.by("date").descending().and(Sort.by("createdAt").descending()));

        Page<Transaction> transactions;

        // For filtering (listing), return null when no category specified — don't auto-create
        Category categoryResolved = resolveCategoryFilter(categoryId, category, user);

        if (type != null && categoryResolved != null && startDate != null && endDate != null) {
            transactions = transactionRepository.findByUserAndTypeAndCategoryAndDateBetween(
                    user, type, categoryResolved, startDate, endDate, pageable);
        } else if (type != null && categoryResolved != null) {
            transactions = transactionRepository.findByUserAndTypeAndCategory(user, type, categoryResolved, pageable);
        } else if (type != null && startDate != null && endDate != null) {
            transactions = transactionRepository.findByUserAndTypeAndDateBetween(user, type, startDate, endDate, pageable);
        } else if (categoryResolved != null && startDate != null && endDate != null) {
            transactions = transactionRepository.findByUserAndCategoryAndDateBetween(user, categoryResolved, startDate, endDate, pageable);
        } else if (type != null) {
            transactions = transactionRepository.findByUserAndType(user, type, pageable);
        } else if (categoryResolved != null) {
            transactions = transactionRepository.findByUserAndCategory(user, categoryResolved, pageable);
        } else if (startDate != null && endDate != null) {
            transactions = transactionRepository.findByUserAndDateBetween(user, startDate, endDate, pageable);
        } else {
            transactions = transactionRepository.findByUser(user, pageable);
        }

        return transactions.map(this::toResponse);
    }

    public TransactionResponse getTransactionById(Long id) {
        User user = getCurrentUser();
        Transaction transaction = transactionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));
        return toResponse(transaction);
    }

    @Transactional
    public TransactionResponse createTransaction(TransactionRequest request) {
        User user = getCurrentUser();
        Category category = resolveCategory(request.getCategoryId(), request.getCategory(), user);
        if (category == null) throw new ResourceNotFoundException("Category not provided");
        LocalDate date = parseRequestDate(request.getDate());

        Transaction transaction = Transaction.builder()
                .user(user)
                .category(category)
                .amount(request.getAmount())
                .type(request.getType())
                .title(request.getTitle())
                .note(request.getNote())
                .source(request.getSource() != null ? request.getSource() : Transaction.TransactionSource.MANUAL)
                .date(date)
                .time(request.getTime() != null ? request.getTime() : LocalTime.now())
                .build();

        Transaction saved = transactionRepository.save(transaction);

        writeAuditLog(user, AuditLog.AuditAction.CREATE, "Transaction", saved.getId(),
                "Created transaction: " + saved.getTitle() + " ₹" + saved.getAmount());

        return toResponse(saved);
    }

    @Transactional
    public TransactionResponse updateTransaction(Long id, TransactionRequest request) {
        User user = getCurrentUser();
        Transaction transaction = transactionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));

        Category category = resolveCategory(request.getCategoryId(), request.getCategory(), user);
        if (category == null) throw new ResourceNotFoundException("Category not provided");
        LocalDate date = parseRequestDate(request.getDate());

        transaction.setAmount(request.getAmount());
        transaction.setType(request.getType());
        transaction.setTitle(request.getTitle());
        transaction.setNote(request.getNote());
        transaction.setCategory(category);
        transaction.setDate(date);
        if (request.getTime() != null) transaction.setTime(request.getTime());

        Transaction saved = transactionRepository.save(transaction);

        writeAuditLog(user, AuditLog.AuditAction.UPDATE, "Transaction", saved.getId(),
                "Updated transaction: " + saved.getTitle() + " ₹" + saved.getAmount());

        return toResponse(saved);
    }

    @Transactional
    public void deleteTransaction(Long id) {
        User user = getCurrentUser();
        Transaction transaction = transactionRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("Transaction", id));

        writeAuditLog(user, AuditLog.AuditAction.DELETE, "Transaction", transaction.getId(),
                "Deleted transaction: " + transaction.getTitle() + " ₹" + transaction.getAmount());

        transactionRepository.delete(transaction);
    }

    public List<TransactionResponse> getRecentTransactions(int limit) {
        User user = getCurrentUser();
        Pageable pageable = PageRequest.of(0, limit);
        return transactionRepository.findTopByUser(user, pageable).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private void writeAuditLog(User user, AuditLog.AuditAction action, String entityType, Long entityId, String desc) {
        AuditLog log = AuditLog.builder()
                .user(user)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .description(desc)
                .build();
        auditLogRepository.save(log);
    }

    public TransactionResponse toResponse(Transaction t) {
        String dateStr = t.getDate() != null ? t.getDate().toString() + "T00:00:00Z" : null;
        return TransactionResponse.builder()
                .id(t.getId() != null ? t.getId().toString() : null)
                .amount(t.getAmount())
                .type(t.getType() != null ? t.getType().name().toLowerCase() : null)
                .title(t.getTitle())
                .note(t.getNote())
                .source(t.getSource() != null ? t.getSource().name().toLowerCase() : "manual")
                .date(dateStr)
                .category(t.getCategory() != null ? t.getCategory().getName() : null)
                .categoryId(t.getCategory() != null && t.getCategory().getId() != null
                        ? t.getCategory().getId().toString() : null)
                .categoryIcon(t.getCategory() != null ? t.getCategory().getIcon() : null)
                .categoryColor(t.getCategory() != null ? t.getCategory().getColor() : null)
                .build();
    }

    /** For LISTING/FILTERING: returns null when no category specified (no filter). */
    private Category resolveCategoryFilter(Long categoryId, String categoryName, User user) {
        if (categoryId != null) {
            return categoryService.findByIdAndUser(categoryId, user);
        }
        if (categoryName == null || categoryName.isBlank()) {
            return null; // no category filter requested
        }
        return categoryService.findByNameAndUser(categoryName.trim(), user);
    }

    /** For CREATING/SAVING: auto-creates "Other" if nothing matches — never returns null. */
    private Category resolveCategory(Long categoryId, String categoryName, User user) {
        if (categoryId != null) {
            return categoryService.findByIdAndUser(categoryId, user);
        }
        // Use findOrCreateByName — never throws, creates the category if missing
        return categoryService.findOrCreateByName(
                (categoryName == null || categoryName.isBlank()) ? "Other" : categoryName.trim(),
                user
        );
    }

    private LocalDate parseRequestDate(String rawDate) {
        // Supports both "YYYY-MM-DD" and full ISO datetime strings from the frontend.
        if (rawDate == null || rawDate.isBlank()) return null;
        String v = rawDate.trim();
        if (v.length() >= 10) v = v.substring(0, 10);
        return LocalDate.parse(v);
    }
}
