package com.smartspend.dto;

import com.smartspend.model.Transaction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionResponse {

    private String id;
    private String title;
    private BigDecimal amount;
    private String type;           // "income" or "expense" (lowercase)
    private String category;       // category name
    private String categoryIcon;
    private String categoryColor;
    private String date;           // ISO string e.g. "2026-03-25T00:00:00Z"
    private String note;
    private String source;         // "manual", "ai", "receipt", "sms" (lowercase)
    private String categoryId;     // string for frontend
}
