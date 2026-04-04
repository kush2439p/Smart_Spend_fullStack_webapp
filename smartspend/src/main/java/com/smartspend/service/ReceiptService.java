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

    @Value("${google.vision.api-key}")
    private String googleVisionApiKey;

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    private static final String VISION_API_URL =
            "https://vision.googleapis.com/v1/images:annotate?key=";
    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=";

    public Map<String, Object> scanReceipt(MultipartFile file) {
        try {
            String contentType = file.getContentType();
            String extractedText;

            if (contentType != null && contentType.equalsIgnoreCase("application/pdf")) {
                log.info("Processing PDF receipt");
                extractedText = extractTextFromPdf(file.getBytes());
            } else {
                log.info("Processing image receipt, type={}", contentType);
                String base64Image = Base64.getEncoder().encodeToString(file.getBytes());
                extractedText = callGoogleVisionApi(base64Image);
            }

            if (extractedText == null || extractedText.isBlank()) {
                return errorResult("Could not read the receipt. Please try again with a clearer image.");
            }

            log.info("OCR extracted {} chars, sending to Gemini", extractedText.length());
            return parseWithGemini(extractedText);

        } catch (Exception e) {
            log.error("Receipt scan failed: {}", e.getMessage(), e);
            return errorResult("Could not read the receipt. Please try again with a clearer image.");
        }
    }

    private String extractTextFromPdf(byte[] pdfBytes) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setEndPage(1);
            return stripper.getText(doc);
        }
    }

    private String callGoogleVisionApi(String base64Image) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> image = Map.of("content", base64Image);
        Map<String, Object> feature = Map.of("type", "TEXT_DETECTION", "maxResults", 1);
        Map<String, Object> req = Map.of("image", image, "features", List.of(feature));
        Map<String, Object> body = Map.of("requests", List.of(req));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                VISION_API_URL + googleVisionApiKey, HttpMethod.POST, entity, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode annotations = root.path("responses").get(0).path("textAnnotations");
        if (annotations.isEmpty()) return "";
        return annotations.get(0).path("description").asText();
    }

    private Map<String, Object> parseWithGemini(String ocrText) throws Exception {
        String prompt = "Extract the following information from this receipt/bill text and return ONLY a valid JSON object with no extra text, no markdown, no code blocks:\n"
                + "{\n"
                + "  \"merchant\": \"store or company name\",\n"
                + "  \"amount\": total amount as a number (no currency symbols),\n"
                + "  \"date\": \"date in YYYY-MM-DD format or null if not found\",\n"
                + "  \"category\": \"one of: Food, Transport, Shopping, Entertainment, Healthcare, Utilities, Education, Travel, Groceries, Dining, Other\",\n"
                + "  \"type\": \"expense or income\",\n"
                + "  \"items\": [\"list of purchased items if visible, max 5\"],\n"
                + "  \"currency\": \"currency code like INR or USD\",\n"
                + "  \"notes\": \"any other relevant info or empty string\"\n"
                + "}\n\nReceipt text:\n" + ocrText;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> part = Map.of("text", prompt);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> body = Map.of("contents", List.of(content));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                GEMINI_API_URL + geminiApiKey, HttpMethod.POST, entity, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        String rawText = root.path("candidates").get(0)
                .path("content").path("parts").get(0)
                .path("text").asText();

        String json = rawText.trim()
                .replaceAll("(?s)```json\\s*", "")
                .replaceAll("(?s)```\\s*", "")
                .trim();

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
