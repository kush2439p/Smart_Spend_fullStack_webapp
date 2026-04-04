package com.smartspend.service;

import com.smartspend.dto.SmsParseRequest;
import com.smartspend.model.User;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsService {

    private final UserRepository userRepository;

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public Map<String, Object> parseSms(SmsParseRequest request) {
        String text = request.getText();
        Map<String, Object> result = new HashMap<>();

        BigDecimal amount = extractAmount(text);
        String type = detectTransactionType(text);
        String merchant = extractMerchant(text);
        String suggestedCategory = suggestCategory(merchant + " " + text);

        result.put("amount", amount);
        result.put("type", type);
        result.put("merchant", merchant);
        result.put("suggestedCategory", suggestedCategory);
        result.put("date", extractDate(request.getTimestamp()));
        result.put("rawText", text);
        result.put("isConfirmed", false);

        return result;
    }

    private BigDecimal extractAmount(String text) {
        List<Pattern> amountPatterns = List.of(
                Pattern.compile("(?:Rs\\.?|INR)\\s*([\\d,]+\\.?\\d*)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("([\\d,]+\\.?\\d*)\\s*(?:debited|credited|deducted|paid)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("(?:of|for)\\s+(?:Rs\\.?|INR)?\\s*([\\d,]+\\.?\\d*)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("([\\d,]+\\.\\d{2})")
        );

        for (Pattern pattern : amountPatterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                try {
                    String numStr = matcher.group(1).replace(",", "");
                    return new BigDecimal(numStr);
                } catch (NumberFormatException ignored) {}
            }
        }

        return BigDecimal.ZERO;
    }

    private String detectTransactionType(String text) {
        String lower = text.toLowerCase();

        if (lower.contains("debited") || lower.contains("paid") || lower.contains("deducted")
                || lower.contains("spent") || lower.contains("withdrawn") || lower.contains("purchase")) {
            return "EXPENSE";
        }

        if (lower.contains("credited") || lower.contains("received") || lower.contains("deposited")
                || lower.contains("refund") || lower.contains("cashback") || lower.contains("transferred to your")) {
            return "INCOME";
        }

        return "EXPENSE";
    }

    private String extractMerchant(String text) {
        List<Pattern> merchantPatterns = List.of(
                Pattern.compile("(?:at|to|from|@)\\s+([A-Za-z][A-Za-z0-9\\s&'.,-]{2,40}?)(?:\\s+on|\\s+for|\\.|,|$)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("VPA\\s+([\\w.@-]+)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("(?:merchant|store)[:\\s]+([A-Za-z0-9\\s&'.,-]{2,40})", Pattern.CASE_INSENSITIVE)
        );

        for (Pattern pattern : merchantPatterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                return matcher.group(1).trim();
            }
        }

        return "Unknown";
    }

    private String extractDate(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return LocalDate.now().toString();
        }
        try {
            return LocalDate.parse(timestamp.substring(0, 10)).toString();
        } catch (Exception e) {
            return LocalDate.now().toString();
        }
    }

    private String suggestCategory(String text) {
        String lower = text.toLowerCase();

        Map<String, List<String>> keywords = new LinkedHashMap<>();
        keywords.put("Food", List.of("zomato", "swiggy", "restaurant", "food", "cafe", "coffee", "pizza", "burger", "biryani"));
        keywords.put("Transport", List.of("uber", "ola", "rapido", "petrol", "fuel", "metro", "irctc", "redbus", "flight"));
        keywords.put("Shopping", List.of("amazon", "flipkart", "myntra", "ajio", "mall", "store", "shop", "market"));
        keywords.put("Health", List.of("pharmacy", "medical", "hospital", "clinic", "doctor", "apollo", "medplus"));
        keywords.put("Bills", List.of("electricity", "bescom", "msedcl", "internet", "broadband", "jio", "airtel", "vodafone", "gas", "lpg", "water"));
        keywords.put("Entertainment", List.of("netflix", "hotstar", "amazon prime", "spotify", "bookmyshow", "cinema", "movie", "pvr"));
        keywords.put("Education", List.of("udemy", "coursera", "byju", "school", "college", "tuition", "book", "stationery"));

        for (Map.Entry<String, List<String>> entry : keywords.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (lower.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }

        return "Other";
    }
}
