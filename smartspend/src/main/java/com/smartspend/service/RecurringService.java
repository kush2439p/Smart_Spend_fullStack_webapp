package com.smartspend.service;

import com.smartspend.dto.RecurringRequest;
import com.smartspend.dto.RecurringResponse;
import com.smartspend.exception.ResourceNotFoundException;
import com.smartspend.model.*;
import com.smartspend.repository.AuditLogRepository;
import com.smartspend.repository.RecurringTransactionRepository;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecurringService {

    private final RecurringTransactionRepository recurringRepo;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final CategoryService categoryService;
    private final AuditLogRepository auditLogRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<RecurringResponse> getAllRecurring() {
        User user = getCurrentUser();
        return recurringRepo.findByUser(user).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public RecurringResponse createRecurring(RecurringRequest request) {
        User user = getCurrentUser();
        Category category = categoryService.findByIdAndUser(request.getCategoryId(), user);

        RecurringTransaction rt = RecurringTransaction.builder()
                .user(user)
                .category(category)
                .amount(request.getAmount())
                .type(request.getType())
                .title(request.getTitle())
                .frequency(request.getFrequency())
                .nextDueDate(request.getNextDueDate())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        return toResponse(recurringRepo.save(rt));
    }

    @Transactional
    public RecurringResponse updateRecurring(Long id, RecurringRequest request) {
        User user = getCurrentUser();
        RecurringTransaction rt = recurringRepo.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringTransaction", id));

        Category category = categoryService.findByIdAndUser(request.getCategoryId(), user);

        rt.setCategory(category);
        rt.setAmount(request.getAmount());
        rt.setType(request.getType());
        rt.setTitle(request.getTitle());
        rt.setFrequency(request.getFrequency());
        rt.setNextDueDate(request.getNextDueDate());
        if (request.getIsActive() != null) rt.setActive(request.getIsActive());

        return toResponse(recurringRepo.save(rt));
    }

    @Transactional
    public void deleteRecurring(Long id) {
        User user = getCurrentUser();
        RecurringTransaction rt = recurringRepo.findByIdAndUser(id, user)
                .orElseThrow(() -> new ResourceNotFoundException("RecurringTransaction", id));
        recurringRepo.delete(rt);
    }

    @Scheduled(cron = "0 0 0 * * *") // Every day at midnight
    @Transactional
    public void processRecurringTransactions() {
        LocalDate today = LocalDate.now();
        log.info("Processing recurring transactions for date: {}", today);

        List<RecurringTransaction> dueToday = recurringRepo.findByIsActiveAndNextDueDate(true, today);

        for (RecurringTransaction rt : dueToday) {
            try {
                // Create actual transaction
                Transaction transaction = Transaction.builder()
                        .user(rt.getUser())
                        .category(rt.getCategory())
                        .amount(rt.getAmount())
                        .type(rt.getType())
                        .title(rt.getTitle())
                        .note("Auto-generated from recurring: " + rt.getTitle())
                        .source(Transaction.TransactionSource.RECURRING)
                        .date(today)
                        .time(LocalTime.now())
                        .build();

                transactionRepository.save(transaction);

                // Write audit log
                AuditLog auditLog = AuditLog.builder()
                        .user(rt.getUser())
                        .action(AuditLog.AuditAction.CREATE)
                        .entityType("Transaction")
                        .entityId(transaction.getId())
                        .description("Recurring transaction auto-created: " + rt.getTitle() + " ₹" + rt.getAmount())
                        .build();
                auditLogRepository.save(auditLog);

                // Update next due date
                LocalDate nextDate = calculateNextDueDate(today, rt.getFrequency());
                rt.setNextDueDate(nextDate);
                recurringRepo.save(rt);

                log.info("Processed recurring transaction: {} for user: {}", rt.getTitle(), rt.getUser().getEmail());
            } catch (Exception e) {
                log.error("Failed to process recurring transaction id={}: {}", rt.getId(), e.getMessage());
            }
        }
    }

    private LocalDate calculateNextDueDate(LocalDate current, RecurringTransaction.Frequency frequency) {
        return switch (frequency) {
            case DAILY -> current.plusDays(1);
            case WEEKLY -> current.plusWeeks(1);
            case MONTHLY -> current.plusMonths(1);
        };
    }

    private RecurringResponse toResponse(RecurringTransaction rt) {
        return RecurringResponse.builder()
                .id(rt.getId())
                .categoryId(rt.getCategory().getId())
                .categoryName(rt.getCategory().getName())
                .categoryColor(rt.getCategory().getColor())
                .categoryIcon(rt.getCategory().getIcon())
                .amount(rt.getAmount())
                .type(rt.getType())
                .title(rt.getTitle())
                .frequency(rt.getFrequency())
                .nextDueDate(rt.getNextDueDate())
                .isActive(rt.isActive())
                .createdAt(rt.getCreatedAt())
                .build();
    }
}
