package com.smartspend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspend.dto.InsightResponse;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InsightService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=";

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public InsightResponse getInsights() {
        User user = getCurrentUser();

        LocalDate today = LocalDate.now();
        LocalDate thirtyDaysAgo = today.minusDays(30);
        LocalDate sixtyDaysAgo = today.minusDays(60);

        List<Transaction> currentPeriod = transactionRepository.findByUserAndDateBetweenList(user, thirtyDaysAgo, today);
        List<Transaction> previousPeriod = transactionRepository.findByUserAndDateBetweenList(user, sixtyDaysAgo, thirtyDaysAgo);

        BigDecimal currentTotal = currentPeriod.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal previousTotal = previousPeriod.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> categorySpending = new LinkedHashMap<>();
        for (Transaction t : currentPeriod) {
            if (t.getType() == Transaction.TransactionType.EXPENSE) {
                categorySpending.merge(t.getCategory().getName(), t.getAmount(), BigDecimal::add);
            }
        }

        List<Map.Entry<String, BigDecimal>> sortedCategories = categorySpending.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                .collect(Collectors.toList());

        String topCategory = sortedCategories.isEmpty() ? "N/A" : sortedCategories.get(0).getKey();
        BigDecimal topCategoryAmount = sortedCategories.isEmpty() ? BigDecimal.ZERO : sortedCategories.get(0).getValue();

        BigDecimal dailyAverage = currentTotal.compareTo(BigDecimal.ZERO) > 0
                ? currentTotal.divide(BigDecimal.valueOf(30), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        Map<String, Long> categoryCount = currentPeriod.stream()
                .filter(t -> t.getType() == Transaction.TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(t -> t.getCategory().getName(), Collectors.counting()));
        String mostFrequent = categoryCount.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("N/A");

        String spendingData = String.format(
                "Last 30 days spending summary:\n" +
                "- Total spent: Rs.%s\n" +
                "- Previous 30 days total: Rs.%s\n" +
                "- Daily average: Rs.%s\n" +
                "- Top category by amount: %s (Rs.%s)\n" +
                "- Most frequent category: %s\n" +
                "- Category breakdown: %s\n" +
                "- Total transactions: %d",
                currentTotal.toPlainString(),
                previousTotal.toPlainString(),
                dailyAverage.toPlainString(),
                topCategory,
                topCategoryAmount.toPlainString(),
                mostFrequent,
                sortedCategories.stream()
                        .map(e -> e.getKey() + ": Rs." + e.getValue())
                        .collect(Collectors.joining(", ")),
                currentPeriod.size()
        );

        List<String> insights = callGeminiForInsights(spendingData, user.getName());
        return InsightResponse.builder().insights(insights).build();
    }

    private List<String> callGeminiForInsights(String spendingData, String userName) {
        try {
            String prompt = "Based on this spending data for " + userName + ", give exactly 4 short, friendly, " +
                    "actionable financial insights. Each insight should be maximum 2 sentences. " +
                    "Be specific with numbers when available. Be encouraging but honest.\n\n" +
                    "Respond ONLY with a raw JSON array of 4 strings, no markdown, no code fences, no extra text:\n" +
                    "[\"insight 1\", \"insight 2\", \"insight 3\", \"insight 4\"]\n\n" +
                    "Spending data:\n" + spendingData;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> textPart = Map.of("text", prompt);
            Map<String, Object> parts = Map.of("parts", List.of(textPart));
            Map<String, Object> body = Map.of("contents", List.of(parts));

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    GEMINI_API_URL + geminiApiKey,
                    HttpMethod.POST, entity, String.class);

            JsonNode root = objectMapper.readTree(response.getBody());
            String text = root.path("candidates")
                    .get(0).path("content").path("parts").get(0).path("text").asText();

            String cleaned = text.strip().replaceAll("(?s)```json\\s*|```\\s*", "").strip();
            JsonNode array = objectMapper.readTree(cleaned);

            List<String> insights = new ArrayList<>();
            for (JsonNode node : array) {
                insights.add(node.asText());
            }
            return insights;

        } catch (Exception e) {
            log.error("Failed to get insights from Gemini: {}", e.getMessage());
            return List.of(
                    "Track your daily expenses to understand your spending patterns better.",
                    "Setting budget limits for your top spending categories can help you save more.",
                    "Consider reviewing your subscriptions and recurring expenses regularly.",
                    "Aim to save at least 20% of your monthly income for financial security."
            );
        }
    }
}
