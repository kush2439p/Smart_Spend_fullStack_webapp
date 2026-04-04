package com.smartspend.dto;

import com.smartspend.model.RecurringTransaction;
import com.smartspend.model.Transaction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class RecurringRequest {

    @NotNull(message = "Category ID is required")
    private Long categoryId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Type is required")
    private Transaction.TransactionType type;

    @NotBlank(message = "Title is required")
    private String title;

    @NotNull(message = "Frequency is required")
    private RecurringTransaction.Frequency frequency;

    @NotNull(message = "Next due date is required")
    private LocalDate nextDueDate;

    private Boolean isActive = true;
}
