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
        String prompt = "You are a financial SMS parser for Indian banking and UPI apps.\n" +
                "Analyze this SMS and return ONLY a raw JSON object — no markdown, no code fences, start with { end with }.\n\n" +
                "JSON format:\n" +
                "{\n" +
                "  \"isTransaction\": true or false,\n" +
                "  \"amount\": total_amount_as_plain_number,\n" +
                "  \"type\": \"EXPENSE or INCOME\",\n" +
                "  \"merchant\": \"payee or payer name\",\n" +
                "  \"suggestedCategory\": \"see list below\",\n" +
                "  \"date\": \"YYYY-MM-DD or null\"\n" +
                "}\n\n" +
                "STEP 1 — Decide isTransaction:\n" +
                "Set isTransaction=false for: OTPs, login alerts, SIM card notifications, promotional/marketing messages, low balance warnings, account balance enquiry replies, KYC reminders, mobile number linking, reward points updates, missed call alerts.\n" +
                "Set isTransaction=true ONLY for actual money movement: debit/credit/payment/transfer/withdrawal/deposit/refund/cashback/salary.\n" +
                "If isTransaction=false, set amount=0, type=EXPENSE, merchant=null, suggestedCategory=Other.\n\n" +
                "STEP 2 — For real transactions:\n" +
                "type=INCOME: credited/received/deposited/refunded/cashback/salary/transferred to your account.\n" +
                "type=EXPENSE: debited/paid/transferred from your account/purchase/withdrawn.\n" +
                "merchant: extract from 'to X', 'at X', 'from X', VPA like xyz@paytm, merchant name after 'at '.\n" +
                "amount: grand total paid/received as a plain number (no commas, no currency symbols).\n\n" +
                "suggestedCategory must be exactly one of:\n" +
                "Food (restaurants, Zomato, Swiggy, food delivery, bakery, cafe)\n" +
                "Transport (Uber, Ola, Rapido, petrol, fuel, metro, IRCTC, bus, cab, auto, Rapido)\n" +
                "Shopping (Amazon, Flipkart, Myntra, mall, retail, clothing, electronics)\n" +
                "Groceries (BigBasket, Blinkit, Zepto, supermarket, grocery, vegetables, milk)\n" +
                "Healthcare (pharmacy, hospital, clinic, doctor, medicine, Apollo, MedPlus, Netmeds)\n" +
                "Utilities (electricity, BESCOM, water, internet, Jio, Airtel, Vi, gas, DTH, broadband)\n" +
                "Entertainment (Netflix, Hotstar, Spotify, BookMyShow, cinema, PVR, gaming, OTT)\n" +
                "Education (school, college, fees, course, Udemy, BYJU, tuition)\n" +
                "Travel (hotel, MakeMyTrip, Goibibo, OYO, Airbnb, flight, holiday, trip)\n" +
                "Salary (salary, wage, payroll, stipend, earnings credit from employer)\n" +
                "Other (anything that doesn't fit the above)\n\n" +
                "SMS to analyze:\n" + smsText;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> part = Map.of("text", prompt);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> thinkingConfig = Map.of("thinkingBudget", 0);
        Map<String, Object> generationConfig = Map.of("temperature", 0.1, "maxOutputTokens", 256, "thinkingConfig", thinkingConfig);
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

        // Reject non-financial messages (OTPs, balance alerts, promos, etc.)
        boolean isTransaction = parsed.path("isTransaction").asBoolean(true);
        if (!isTransaction) {
            log.info("SMS identified as non-transaction (OTP/promo/alert), skipping");
            Map<String, Object> skip = new HashMap<>();
            skip.put("isTransaction", false);
            skip.put("amount", 0.0);
            return skip;
        }

        double amount = parsed.path("amount").asDouble(0.0);
        // Secondary guard: if amount is 0, treat as non-transaction
        if (amount <= 0) {
            log.info("SMS parsed with amount=0, treating as non-transaction");
            Map<String, Object> skip = new HashMap<>();
            skip.put("isTransaction", false);
            skip.put("amount", 0.0);
            return skip;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("isTransaction", true);
        result.put("amount", amount);
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
