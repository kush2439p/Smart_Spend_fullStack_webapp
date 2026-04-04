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
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    private static final String EXTRACTION_PROMPT =
            "You are a financial receipt/bill scanner. Extract transaction details and return ONLY a valid JSON object " +
            "with absolutely no extra text, no markdown, no code blocks:\n" +
            "{\n" +
            "  \"merchant\": \"store or company name (string)\",\n" +
            "  \"amount\": total_amount_as_number_no_symbols,\n" +
            "  \"date\": \"YYYY-MM-DD or null\",\n" +
            "  \"category\": \"exactly one of: Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Education, Travel, Groceries, Dining, Other\",\n" +
            "  \"type\": \"expense or income\",\n" +
            "  \"items\": [\"item1\", \"item2\"],\n" +
            "  \"currency\": \"INR or USD etc\",\n" +
            "  \"notes\": \"any extra info or empty string\"\n" +
            "}\n" +
            "Rules: amount must be a plain number (e.g. 250.50), date must be YYYY-MM-DD or null, type must be expense or income.";

    public Map<String, Object> scanReceipt(MultipartFile file) {
        try {
            String contentType = file.getContentType();

            if (contentType != null && contentType.equalsIgnoreCase("application/pdf")) {
                log.info("Processing PDF receipt");
                String text = extractTextFromPdf(file.getBytes());
                if (text == null || text.isBlank()) {
                    return errorResult("Could not extract text from this PDF. Make sure it is a text-based PDF, not a scanned image.");
                }
                log.info("PDF text extracted ({} chars), sending to Gemini", text.length());
                return parseTextWithGemini(text);
            } else {
                log.info("Processing image receipt, contentType={}", contentType);
                String base64Image = Base64.getEncoder().encodeToString(file.getBytes());
                String mime = (contentType != null && !contentType.isBlank()) ? contentType : "image/jpeg";
                return parseImageWithGemini(base64Image, mime);
            }

        } catch (Exception e) {
            log.error("Receipt scan failed: {}", e.getMessage(), e);
            return errorResult("Could not process the receipt. Please try again with a clearer photo.");
        }
    }

    private String extractTextFromPdf(byte[] pdfBytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setEndPage(2);
            return stripper.getText(doc);
        }
    }

    private Map<String, Object> parseImageWithGemini(String base64Image, String mimeType) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> textPart = Map.of("text", EXTRACTION_PROMPT);
        Map<String, Object> imageData = Map.of("mime_type", mimeType, "data", base64Image);
        Map<String, Object> imagePart = Map.of("inline_data", imageData);
        Map<String, Object> content = Map.of("parts", List.of(textPart, imagePart));
        Map<String, Object> generationConfig = Map.of("temperature", 0.1, "maxOutputTokens", 512);
        Map<String, Object> body = Map.of("contents", List.of(content), "generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        log.info("Gemini Vision response status: {}", response.getStatusCode());
        return parseGeminiJsonResponse(response.getBody());
    }

    private Map<String, Object> parseTextWithGemini(String receiptText) throws Exception {
        String fullPrompt = EXTRACTION_PROMPT + "\n\nReceipt/Bill text:\n" + receiptText;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = Map.of("text", fullPrompt);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> generationConfig = Map.of("temperature", 0.1, "maxOutputTokens", 512);
        Map<String, Object> body = Map.of("contents", List.of(content), "generationConfig", generationConfig);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        log.info("Gemini Text response status: {}", response.getStatusCode());
        return parseGeminiJsonResponse(response.getBody());
    }

    private Map<String, Object> parseGeminiJsonResponse(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);

        if (root.has("error")) {
            String errMsg = root.path("error").path("message").asText("Gemini API error");
            log.error("Gemini API error: {}", errMsg);
            return errorResult("AI processing failed: " + errMsg);
        }

        JsonNode candidates = root.path("candidates");
        if (candidates.isEmpty()) {
            log.error("Gemini returned no candidates. Body: {}", responseBody);
            return errorResult("AI could not extract data from this receipt. Please enter details manually.");
        }

        String rawText = candidates.get(0)
                .path("content").path("parts").get(0)
                .path("text").asText("{}");

        String json = rawText.trim()
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "")
                .trim();

        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start >= 0 && end > start) {
            json = json.substring(start, end + 1);
        }

        log.info("Extracted JSON from Gemini: {}", json);
        JsonNode parsed = objectMapper.readTree(json);

        Map<String, Object> result = new HashMap<>();
        result.put("merchant", parsed.path("merchant").asText("Unknown Merchant"));
        result.put("amount", parsed.path("amount").asDouble(0.0));

        String date = parsed.path("date").asText("");
        result.put("date", (date.isBlank() || date.equals("null"))
                ? LocalDate.now().toString() : date);

        String category = parsed.path("category").asText("Other");
        result.put("category", category);
        result.put("suggestedCategory", category);
        result.put("type", parsed.path("type").asText("expense").toLowerCase());

        List<String> items = new ArrayList<>();
        parsed.path("items").forEach(item -> {
            if (!item.asText().isBlank()) items.add(item.asText());
        });
        result.put("items", items);
        result.put("currency", parsed.path("currency").asText("INR"));
        result.put("notes", parsed.path("notes").asText(""));
        return result;
    }

    private Map<String, Object> errorResult(String message) {
        Map<String, Object> err = new HashMap<>();
        err.put("error", message);
        return err;
    }
}
