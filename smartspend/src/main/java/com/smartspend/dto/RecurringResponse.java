package com.smartspend.dto;

import com.smartspend.model.RecurringTransaction;
import com.smartspend.model.Transaction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecurringResponse {

    private Long id;
    private Long categoryId;
    private String categoryName;
    private String categoryColor;
    private String categoryIcon;
    private BigDecimal amount;
    private Transaction.TransactionType type;
    private String title;
    private RecurringTransaction.Frequency frequency;
    private LocalDate nextDueDate;
    private boolean isActive;
    private LocalDateTime createdAt;
}
