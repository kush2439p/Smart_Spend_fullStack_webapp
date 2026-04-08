package com.smartspend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReceiptService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 1500;

    private static final String EXTRACTION_PROMPT =
            "You are a financial receipt scanner. Analyze this image carefully.\n" +
            "This could be a receipt, bill, invoice, bank SMS screenshot, payment app screen, UPI confirmation, or any financial document.\n\n" +
            "IMPORTANT: You MUST return ONLY a raw JSON object — no markdown, no code fences, no explanation text before or after.\n" +
            "Start your response with { and end with }.\n\n" +
            "Required JSON format:\n" +
            "{\n" +
            "  \"merchant\": \"name of store, restaurant, app, or service\",\n" +
            "  \"amount\": 250.50,\n" +
            "  \"date\": \"YYYY-MM-DD\",\n" +
            "  \"category\": \"Food\",\n" +
            "  \"type\": \"expense\",\n" +
            "  \"items\": [\"item 1\", \"item 2\"],\n" +
            "  \"currency\": \"INR\",\n" +
            "  \"notes\": \"brief description\"\n" +
            "}\n\n" +
            "Rules:\n" +
            "1. amount: always a plain number with no currency symbols (e.g. 350 or 1250.50). If multiple amounts shown, use the GRAND TOTAL or final payable amount.\n" +
            "2. date: YYYY-MM-DD format. If not visible, use null.\n" +
            "3. category: must be exactly one of: Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Education, Travel, Groceries, Dining, Other.\n" +
            "4. type: 'expense' for purchases/payments/debits. 'income' for refunds/salary/received money.\n" +
            "5. currency: 'INR' unless you clearly see another currency symbol.\n" +
            "6. If the image is blurry but you can make out partial info, extract what you can — do NOT refuse.\n" +
            "7. merchant: be as specific as possible — brand name, restaurant name, app name, etc.\n" +
            "8. items: list individual line items if visible, otherwise empty array [].\n" +
            "Remember: respond with ONLY the JSON object, nothing else.";

    // ── Public entry point ─────────────────────────────────────────────────
    public Map<String, Object> scanReceipt(MultipartFile file) {
        try {
            String contentType = file.getContentType();

            if (contentType != null && contentType.equalsIgnoreCase("application/pdf")) {
                log.info("Processing PDF receipt");
                String text = extractTextFromPdf(file.getBytes());
                if (text == null || text.isBlank()) {
                    return errorResult("Could not extract text from this PDF. Make sure it is a text-based PDF.");
                }
                log.info("PDF text extracted ({} chars)", text.length());
                return parseTextWithGeminiWithRetry(text);
            } else {
                log.info("Processing image receipt, contentType={}, size={} bytes", contentType, file.getSize());
                String base64Image = Base64.getEncoder().encodeToString(file.getBytes());
                String mime = (contentType != null && !contentType.isBlank()) ? contentType : "image/jpeg";
                return parseImageWithGeminiWithRetry(base64Image, mime);
            }

        } catch (Exception e) {
            log.error("Receipt scan failed: {}", e.getMessage(), e);
            return errorResult("Could not process the receipt. Please try again.");
        }
    }

    // ── Retry wrappers ─────────────────────────────────────────────────────
    private Map<String, Object> parseImageWithGeminiWithRetry(String base64Image, String mimeType) {
        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                log.info("Receipt image scan attempt {}/{}", attempt, MAX_RETRIES);
                Map<String, Object> result = parseImageWithGemini(base64Image, mimeType);

                // Consider it a failure if amount is 0 AND merchant is unknown (bad extraction)
                double amount = toDouble(result.get("amount"));
                String merchant = String.valueOf(result.getOrDefault("merchant", ""));
                boolean looksBad = amount <= 0 && (merchant.isBlank() || merchant.equalsIgnoreCase("Unknown Merchant"));

                if (looksBad && attempt < MAX_RETRIES) {
                    log.warn("Attempt {} returned empty result, retrying...", attempt);
                    Thread.sleep(RETRY_DELAY_MS);
                    continue;
                }
                return result;
            } catch (Exception e) {
                lastException = e;
                log.warn("Receipt scan attempt {} failed: {}", attempt, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(RETRY_DELAY_MS * attempt); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }
        log.error("All {} attempts failed. Last error: {}", MAX_RETRIES, lastException != null ? lastException.getMessage() : "unknown");
        return errorResult("Could not extract data after " + MAX_RETRIES + " attempts. Please enter details manually.");
    }

    private Map<String, Object> parseTextWithGeminiWithRetry(String text) {
        Exception lastException = null;
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                log.info("Receipt text scan attempt {}/{}", attempt, MAX_RETRIES);
                return parseTextWithGemini(text);
            } catch (Exception e) {
                lastException = e;
                log.warn("Text scan attempt {} failed: {}", attempt, e.getMessage());
                if (attempt < MAX_RETRIES) {
                    try { Thread.sleep(RETRY_DELAY_MS); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                }
            }
        }
        return errorResult("Could not parse receipt text. Last error: " + (lastException != null ? lastException.getMessage() : "unknown"));
    }

    // ── Gemini calls ───────────────────────────────────────────────────────
    private Map<String, Object> parseImageWithGemini(String base64Image, String mimeType) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> textPart = Map.of("text", EXTRACTION_PROMPT);
        Map<String, Object> imageData = Map.of("mime_type", mimeType, "data", base64Image);
        Map<String, Object> imagePart = Map.of("inline_data", imageData);
        Map<String, Object> content = Map.of("parts", List.of(textPart, imagePart));
        Map<String, Object> thinkingConfig = Map.of("thinkingBudget", 0);
        Map<String, Object> generationConfig = Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 8192,
                "thinkingConfig", thinkingConfig
        );
        Map<String, Object> body = Map.of(
                "contents", List.of(content),
                "generationConfig", generationConfig
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        log.info("Gemini Vision response status: {}", response.getStatusCode());
        return parseGeminiJsonResponse(response.getBody());
    }

    private Map<String, Object> parseTextWithGemini(String receiptText) throws Exception {
        String fullPrompt = EXTRACTION_PROMPT + "\n\nReceipt/Bill text to analyze:\n" + receiptText;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = Map.of("text", fullPrompt);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> thinkingConfig = Map.of("thinkingBudget", 0);
        Map<String, Object> generationConfig = Map.of(
                "temperature", 0.1,
                "maxOutputTokens", 8192,
                "thinkingConfig", thinkingConfig
        );
        Map<String, Object> body = Map.of(
                "contents", List.of(content),
                "generationConfig", generationConfig
        );

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        log.info("Gemini Text response status: {}", response.getStatusCode());
        return parseGeminiJsonResponse(response.getBody());
    }

    // ── Response parser ────────────────────────────────────────────────────
    private Map<String, Object> parseGeminiJsonResponse(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            String errMsg = root.path("error").path("message").asText("Gemini API error");
            log.error("Gemini API error: {}", errMsg);
            throw new RuntimeException("Gemini API error: " + errMsg);
        }

        JsonNode candidates = root.path("candidates");
        if (candidates.isEmpty()) {
            log.error("Gemini returned no candidates. Body: {}", responseBody);
            throw new RuntimeException("Gemini returned no candidates");
        }

        // Check for content filter / safety block
        String finishReason = candidates.get(0).path("finishReason").asText("");
        if ("SAFETY".equals(finishReason) || "RECITATION".equals(finishReason)) {
            log.warn("Gemini blocked response, finishReason={}", finishReason);
            throw new RuntimeException("Content blocked by Gemini safety filter");
        }

        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (parts.isEmpty()) {
            throw new RuntimeException("No text parts in Gemini response");
        }

        String rawText = parts.get(0).path("text").asText("{}");
        log.info("Raw Gemini response text (first 500 chars): {}", rawText.length() > 500 ? rawText.substring(0, 500) : rawText);

        // Strip markdown code fences if present
        String json = rawText.trim()
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "")
                .trim();

        // Extract the JSON object — handles any prefix/suffix text
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) {
            log.error("No JSON object found in Gemini response: {}", json);
            throw new RuntimeException("No valid JSON object in Gemini response");
        }
        json = json.substring(start, end + 1);

        log.info("Parsed JSON: {}", json);

        JsonNode parsed;
        try {
            parsed = objectMapper.readTree(json);
        } catch (Exception e) {
            log.error("JSON parse failed: {} | JSON was: {}", e.getMessage(), json);
            throw new RuntimeException("Could not parse Gemini JSON response: " + e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("merchant", sanitiseString(parsed.path("merchant").asText("Unknown Merchant")));
        result.put("amount", parsed.path("amount").asDouble(0.0));

        String date = parsed.path("date").asText("");
        result.put("date", (date.isBlank() || date.equals("null")) ? LocalDate.now().toString() : date);

        String category = sanitiseCategory(parsed.path("category").asText("Other"));
        result.put("category", category);
        result.put("suggestedCategory", category);
        result.put("type", parsed.path("type").asText("expense").toLowerCase());

        List<String> items = new ArrayList<>();
        parsed.path("items").forEach(item -> {
            String t = item.asText("").trim();
            if (!t.isBlank()) items.add(t);
        });
        result.put("items", items);
        result.put("currency", parsed.path("currency").asText("INR"));
        result.put("notes", parsed.path("notes").asText(""));
        return result;
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    private String extractTextFromPdf(byte[] pdfBytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setEndPage(3);
            return stripper.getText(doc);
        }
    }

    private static final List<String> VALID_CATEGORIES = List.of(
            "Food", "Transport", "Shopping", "Entertainment", "Healthcare",
            "Utilities", "Education", "Travel", "Groceries", "Dining", "Other"
    );

    private String sanitiseCategory(String raw) {
        if (raw == null || raw.isBlank()) return "Other";
        for (String c : VALID_CATEGORIES) {
            if (c.equalsIgnoreCase(raw.trim())) return c;
        }
        return "Other";
    }

    private String sanitiseString(String s) {
        if (s == null || s.isBlank()) return "Unknown";
        return s.trim().replaceAll("[\\x00-\\x1F]", ""); // strip control chars
    }

    private double toDouble(Object val) {
        if (val == null) return 0;
        try { return Double.parseDouble(String.valueOf(val)); } catch (Exception e) { return 0; }
    }

    private Map<String, Object> errorResult(String message) {
        Map<String, Object> err = new HashMap<>();
        err.put("error", message);
        return err;
    }
}
