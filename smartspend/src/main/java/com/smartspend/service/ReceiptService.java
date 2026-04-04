package com.smartspend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspend.model.User;
import com.smartspend.repository.CategoryRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReceiptService {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${google.vision.api-key}")
    private String googleVisionApiKey;

    private static final String VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate?key=";

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public Map<String, Object> scanReceipt(MultipartFile file) {
        try {
            byte[] imageBytes = file.getBytes();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            String extractedText = callGoogleVisionApi(base64Image);
            return parseReceiptText(extractedText);

        } catch (Exception e) {
            log.error("Receipt scan failed: {}", e.getMessage());
            throw new RuntimeException("Failed to scan receipt: " + e.getMessage());
        }
    }

    private String callGoogleVisionApi(String base64Image) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> image = Map.of("content", base64Image);
        Map<String, Object> feature = Map.of("type", "TEXT_DETECTION", "maxResults", 1);
        Map<String, Object> request = Map.of("image", image, "features", List.of(feature));
        Map<String, Object> body = Map.of("requests", List.of(request));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(
                VISION_API_URL + googleVisionApiKey,
                HttpMethod.POST, entity, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode annotations = root.path("responses").get(0).path("textAnnotations");

        if (annotations.isEmpty()) {
            throw new RuntimeException("No text detected in the receipt image.");
        }

        return annotations.get(0).path("description").asText();
    }

    private Map<String, Object> parseReceiptText(String text) {
        User user = getCurrentUser();
        Map<String, Object> result = new HashMap<>();

        String[] lines = text.split("\n");

        // Extract merchant (typically first meaningful line)
        String merchant = lines.length > 0 ? lines[0].trim() : "Unknown Merchant";
        result.put("merchant", merchant);

        // Extract amount: look for the largest currency amount
        BigDecimal amount = extractLargestAmount(text);
        result.put("amount", amount);

        // Extract date
        String date = extractDate(text);
        result.put("date", date);

        // Suggest category based on merchant/keywords
        String suggestedCategory = suggestCategory(text, user);
        result.put("suggestedCategory", suggestedCategory);

        result.put("rawText", text);
        result.put("isConfirmed", false);
        result.put("type", "EXPENSE");

        return result;
    }

    private BigDecimal extractLargestAmount(String text) {
        List<Pattern> patterns = List.of(
                Pattern.compile("(?:Total|TOTAL|Amount|AMOUNT|Grand Total)[:\\s]+(?:Rs\\.?|INR|₹)?\\s*([\\d,]+\\.?\\d*)"),
                Pattern.compile("(?:Rs\\.?|INR|₹)\\s*([\\d,]+\\.?\\d*)"),
                Pattern.compile("([\\d,]+\\.\\d{2})(?:\\s*(?:INR|Rs))?")
        );

        BigDecimal largest = BigDecimal.ZERO;

        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            while (matcher.find()) {
                try {
                    String numStr = matcher.group(1).replace(",", "");
                    BigDecimal val = new BigDecimal(numStr);
                    if (val.compareTo(largest) > 0) {
                        largest = val;
                    }
                } catch (NumberFormatException ignored) {}
            }
            if (largest.compareTo(BigDecimal.ZERO) > 0) break;
        }

        return largest.compareTo(BigDecimal.ZERO) == 0 ? BigDecimal.ZERO : largest;
    }

    private String extractDate(String text) {
        List<Pattern> datePatterns = List.of(
                Pattern.compile("(\\d{2}[/-]\\d{2}[/-]\\d{4})"),
                Pattern.compile("(\\d{4}[/-]\\d{2}[/-]\\d{2})"),
                Pattern.compile("(\\d{2}[/-]\\d{2}[/-]\\d{2})")
        );

        for (Pattern pattern : datePatterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                return matcher.group(1);
            }
        }

        return LocalDate.now().toString();
    }

    private String suggestCategory(String text, User user) {
        String lowerText = text.toLowerCase();

        Map<String, List<String>> keywords = new LinkedHashMap<>();
        keywords.put("Food", List.of("restaurant", "cafe", "coffee", "burger", "pizza", "food", "zomato", "swiggy", "hotel", "dhaba", "biryani"));
        keywords.put("Transport", List.of("uber", "ola", "cab", "petrol", "diesel", "fuel", "metro", "bus", "taxi", "auto"));
        keywords.put("Shopping", List.of("mall", "amazon", "flipkart", "store", "shop", "mart", "supermarket", "clothes", "fashion"));
        keywords.put("Health", List.of("pharmacy", "medical", "hospital", "clinic", "doctor", "medicine", "drug", "chemist"));
        keywords.put("Bills", List.of("electricity", "water", "gas", "internet", "broadband", "bill", "utility", "recharge"));
        keywords.put("Entertainment", List.of("cinema", "movie", "theatre", "concert", "netflix", "spotify", "game"));
        keywords.put("Education", List.of("book", "course", "tuition", "school", "college", "university", "stationery"));

        for (Map.Entry<String, List<String>> entry : keywords.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (lowerText.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }

        return "Other";
    }
}
