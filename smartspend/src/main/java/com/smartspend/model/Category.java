package com.smartspend.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "categories")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CategoryType type;

    private String color;

    private String icon;

    @Column(nullable = false)
    @Builder.Default
    private boolean isDefault = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum CategoryType {
        INCOME, EXPENSE;

        /**
         * Accept values like "income"/"expense" coming from the frontend.
         */
        @JsonCreator
        public static CategoryType from(String value) {
            if (value == null) return null;
            return CategoryType.valueOf(value.trim().toUpperCase());
        }
    }
}
