package com.smartspend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspend.dto.SmsParseRequest;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsService {

    private final UserRepository userRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

    public Map<String, Object> parseSms(SmsParseRequest request) {
        String text = request.getText();
        log.info("Parsing SMS text ({} chars)", text.length());
        try {
            return parseWithGemini(text, request.getTimestamp());
        } catch (Exception e) {
            log.warn("Gemini SMS parse failed ({}), falling back to regex", e.getMessage());
            return parseWithRegex(text, request.getTimestamp());
        }
    }

    private Map<String, Object> parseWithGemini(String smsText, String timestamp) throws Exception {
        String prompt = "You are a financial SMS parser for Indian banking and UPI apps. " +
                "Analyze this SMS and return ONLY a valid JSON object with no extra text, no markdown:\n" +
                "{\n" +
                "  \"amount\": total_amount_as_number,\n" +
                "  \"type\": \"EXPENSE or INCOME\",\n" +
                "  \"merchant\": \"payee or payer name\",\n" +
                "  \"suggestedCategory\": \"one of: Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Education, Travel, Salary, Groceries, Other\",\n" +
                "  \"date\": \"YYYY-MM-DD or null\"\n" +
                "}\n\n" +
                "Rules: type=INCOME when credited/received/salary/cashback/refund. type=EXPENSE when debited/paid/deducted/purchase.\n" +
                "Extract merchant from 'to X', 'at X', VPA handles like xyz@paytm. Amount must be a plain number.\n\n" +
                "SMS:\n" + smsText;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> part = Map.of("text", prompt);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> generationConfig = Map.of("temperature", 0.1, "maxOutputTokens", 256);
        Map<String, Object> body = Map.of("contents", List.of(content), "generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        String rawText = root.path("candidates").get(0)
                .path("content").path("parts").get(0).path("text").asText("{}");

        String json = rawText.trim()
                .replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
        int s = json.indexOf('{'), e = json.lastIndexOf('}');
        if (s >= 0 && e > s) json = json.substring(s, e + 1);

        JsonNode parsed = objectMapper.readTree(json);
        Map<String, Object> result = new HashMap<>();
        result.put("amount", parsed.path("amount").asDouble(0.0));
        result.put("type", parsed.path("type").asText("EXPENSE").toUpperCase());
        result.put("merchant", parsed.path("merchant").asText("Unknown"));
        result.put("suggestedCategory", parsed.path("suggestedCategory").asText("Other"));
        String date = parsed.path("date").asText("");
        result.put("date", (date.isBlank() || date.equals("null")) ? extractDate(timestamp) : date);
        result.put("rawText", smsText.length() > 80 ? smsText.substring(0, 80) : smsText);
        result.put("isConfirmed", false);
        return result;
    }

    private Map<String, Object> parseWithRegex(String text, String timestamp) {
        Map<String, Object> result = new HashMap<>();
        BigDecimal amount = extractAmount(text);
        String type = detectTransactionType(text);
        String merchant = extractMerchant(text);
        String category = suggestCategory(merchant + " " + text);
        result.put("amount", amount.doubleValue());
        result.put("type", type);
        result.put("merchant", merchant);
        result.put("suggestedCategory", category);
        result.put("date", extractDate(timestamp));
        result.put("rawText", text.length() > 80 ? text.substring(0, 80) : text);
        result.put("isConfirmed", false);
        return result;
    }

    private BigDecimal extractAmount(String text) {
        List<Pattern> patterns = List.of(
                Pattern.compile("(?:Rs\\.?|INR|₹)\\s*([\\d,]+\\.?\\d*)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("([\\d,]+\\.?\\d*)\\s*(?:debited|credited|deducted|paid)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("([\\d,]+\\.\\d{2})")
        );
        for (Pattern p : patterns) {
            Matcher m = p.matcher(text);
            if (m.find()) {
                try { return new BigDecimal(m.group(1).replace(",", "")); }
                catch (NumberFormatException ignored) {}
            }
        }
        return BigDecimal.ZERO;
    }

    private String detectTransactionType(String text) {
        String lower = text.toLowerCase();
        if (lower.contains("credited") || lower.contains("received") || lower.contains("deposited")
                || lower.contains("refund") || lower.contains("cashback") || lower.contains("salary"))
            return "INCOME";
        return "EXPENSE";
    }

    private String extractMerchant(String text) {
        List<Pattern> patterns = List.of(
                Pattern.compile("(?:to|at)\\s+([A-Za-z][A-Za-z0-9\\s&'.,-]{2,40}?)(?:\\s+on|\\s+for|\\.|,|\\s+via|$)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("VPA\\s+([\\w.@-]+)", Pattern.CASE_INSENSITIVE),
                Pattern.compile("([\\w.]+@[\\w.]+)")
        );
        for (Pattern p : patterns) {
            Matcher m = p.matcher(text);
            if (m.find()) return m.group(1).trim();
        }
        return "Unknown";
    }

    private String extractDate(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) return LocalDate.now().toString();
        try { return LocalDate.parse(timestamp.substring(0, 10)).toString(); }
        catch (Exception e) { return LocalDate.now().toString(); }
    }

    private String suggestCategory(String text) {
        String lower = text.toLowerCase();
        Map<String, List<String>> keywords = new LinkedHashMap<>();
        keywords.put("Food", List.of("zomato", "swiggy", "restaurant", "food", "cafe", "coffee", "pizza", "burger", "biryani"));
        keywords.put("Transport", List.of("uber", "ola", "rapido", "petrol", "fuel", "metro", "irctc", "redbus", "flight", "cab"));
        keywords.put("Shopping", List.of("amazon", "flipkart", "myntra", "ajio", "mall", "shop", "market"));
        keywords.put("Healthcare", List.of("pharmacy", "medical", "hospital", "clinic", "doctor", "apollo", "medplus"));
        keywords.put("Utilities", List.of("electricity", "bescom", "internet", "jio", "airtel", "vodafone", "gas", "lpg", "water"));
        keywords.put("Entertainment", List.of("netflix", "hotstar", "spotify", "bookmyshow", "cinema", "movie", "pvr"));
        keywords.put("Salary", List.of("salary", "wage", "payroll", "stipend"));
        keywords.put("Travel", List.of("hotel", "makemytrip", "goibibo", "oyo", "airbnb", "travel", "holiday"));
        for (Map.Entry<String, List<String>> entry : keywords.entrySet())
            for (String kw : entry.getValue())
                if (lower.contains(kw)) return entry.getKey();
        return "Other";
    }
}
