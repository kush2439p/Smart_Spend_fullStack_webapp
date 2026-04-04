package com.smartspend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "transactions")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionType type;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private TransactionSource source = TransactionSource.MANUAL;

    @Column(nullable = false)
    private LocalDate date;

    private LocalTime time;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum TransactionType {
        INCOME, EXPENSE

        ;

        /**
         * Accept values like "income" / "expense" coming from the frontend.
         */
        @JsonCreator
        public static TransactionType from(String value) {
            if (value == null) return null;
            return TransactionType.valueOf(value.trim().toUpperCase());
        }
    }

    public enum TransactionSource {
        MANUAL, AI, RECEIPT, SMS, MAIL, RECURRING;

        /**
         * Accept values like "manual"/"ai"/"receipt"/"sms" coming from the frontend.
         */
        @JsonCreator
        public static TransactionSource from(String value) {
            if (value == null) return null;
            return TransactionSource.valueOf(value.trim().toUpperCase());
        }
    }
}
