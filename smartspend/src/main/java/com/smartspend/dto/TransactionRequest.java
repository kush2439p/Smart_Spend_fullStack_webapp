package com.smartspend.dto;

import com.smartspend.model.Transaction;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;

@Data
public class TransactionRequest {

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Transaction type is required")
    private Transaction.TransactionType type;

    @NotBlank(message = "Title is required")
    private String title;

    private String note;

    // Frontend sends category as a string name — categoryId is optional for backward compat
    private String category;           // category name (used by frontend)
    private Long categoryId;           // category id (optional, legacy)

    private Transaction.TransactionSource source;

    // Frontend sends either "YYYY-MM-DD" or an ISO datetime string.
    // We keep it as String so Jackson always deserializes cleanly.
    @NotBlank(message = "Date is required")
    private String date;

    // Optional: frontend may not send this yet (we default to now if missing).
    private LocalTime time;
}
