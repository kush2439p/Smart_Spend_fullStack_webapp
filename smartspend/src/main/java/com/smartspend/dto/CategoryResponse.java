package com.smartspend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponse {

    private String id;
    private String name;
    private String type;           // "income", "expense", "both" (lowercase)
    private String icon;
    private String color;
    private int transactionCount;
    private double monthlyTotal;
}
