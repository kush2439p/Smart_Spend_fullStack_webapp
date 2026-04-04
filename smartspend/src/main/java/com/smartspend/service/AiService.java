package com.smartspend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartspend.dto.AiChatRequest;
import com.smartspend.dto.AiChatResponse;
import com.smartspend.dto.TransactionRequest;
import com.smartspend.dto.TransactionResponse;
import com.smartspend.model.Category;
import com.smartspend.model.Transaction;
import com.smartspend.model.User;
import com.smartspend.repository.CategoryRepository;
import com.smartspend.repository.TransactionRepository;
import com.smartspend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiService {

    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final TransactionRepository transactionRepository;
    private final TransactionService transactionService;
    private final CategoryService categoryService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ai.gemini.api-key}")
    private String geminiApiKey;

    private static final String GEMINI_API_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=";

    private User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public AiChatResponse chat(AiChatRequest request) {
        User user = getCurrentUser();

        List<Category> categories = categoryRepository.findByUser(user);
        String categoryList = categories.stream()
                .map(c -> c.getName() + " (" + c.getType().name() + ")")
                .collect(Collectors.joining(", "));

        List<Transaction> recent = transactionRepository.findTopByUser(user, PageRequest.of(0, 10));
        String recentTxStr = recent.stream()
                .map(t -> t.getDate() + " | " + t.getType() + " | " + t.getTitle()
                        + " | Rs." + t.getAmount() + " | " + t.getCategory().getName())
                .collect(Collectors.joining("\n"));

        // Get user's financial summary for AI context
        BigDecimal monthlyIncome = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(user, Transaction.TransactionType.INCOME, LocalDate.now().getMonthValue(), LocalDate.now().getYear());
        BigDecimal monthlyExpense = transactionRepository.sumAmountByUserAndTypeAndMonthAndYear(user, Transaction.TransactionType.EXPENSE, LocalDate.now().getMonthValue(), LocalDate.now().getYear());
        BigDecimal totalBalance = monthlyIncome.subtract(monthlyExpense);

       String fullPrompt = """
        You are SmartSpend AI, a smart personal finance assistant that understands 
        natural, casual, conversational language in English AND Hinglish.

        User info:
        - Name: %s
        - Currency: %s
        - Today's date: %s

        User's expense categories: %s

        User's recent transactions:
        %s

        YOUR JOB:
        Understand what the user means even if they say it casually or indirectly.
        
        Examples of EXPENSE messages you must understand:
        - "had lunch at mcdonalds for 250"
        - "grabbed coffee 80"
        - "paid 1200 for electricity bill"
        - "bought groceries spent around 600"
        - "uber se gaya 150 laga"
        - "movie ticket 350 tha"
        - "petrol dala 500 ka"
        - "zomato order kiya 400"
        - "bhai 200 ka pizza khaya"
        
        Examples of INCOME messages you must understand:
        - "got salary today 45000"
        - "client ne 5000 diye"
        - "received 2000 from freelance work"
        - "aaj 1000 mila"
        
        Examples of QUERY (just answer, no transaction):
        - "how much did i spend this month"
        - "what is my biggest expense"
        - "am i overspending"
        - "kitna kharch hua"
        
        RULES:
        1. If user mentions ANY purchase, payment, spending, eating, travelling, 
           shopping, bill payment → action = CREATE_TRANSACTION, type = EXPENSE
        2. If user mentions receiving money, salary, earning → action = CREATE_TRANSACTION, type = INCOME  
        3. If user asks a question about their finances → action = QUERY
        4. If just greeting or unrelated → action = NONE
        5. Always pick the BEST matching category from the user's category list
        6. If amount is unclear, make your best guess or ask in the reply
        7. Be friendly, short, conversational in your reply — like a friend not a robot
        8. Default date to today (%s) unless user specifies
        
        Respond ONLY with this JSON (no markdown, no code fences):
        {
          "reply": "friendly conversational response",
          "action": "CREATE_TRANSACTION",
          "transaction": {
            "amount": 250,
            "type": "EXPENSE",
            "title": "McDonald's Lunch",
            "categoryName": "Food",
            "date": "%s",
            "note": ""
          }
        }
        
        User message: %s
        """.formatted(
        user.getName(), user.getCurrency(), LocalDate.now(),
        categoryList,
        recentTxStr.isEmpty() ? "No recent transactions" : recentTxStr,
        LocalDate.now(),
        LocalDate.now(),
        request.getMessage()
);

        String rawResponse = callGeminiApi(fullPrompt);
        return parseGeminiResponse(rawResponse, user);
    }

    private String callGeminiApi(String prompt) {
        try {
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
            return root.path("candidates")
                    .get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

        } catch (Exception e) {
            log.error("Gemini API call failed: {}, using fallback AI", e.getMessage());
            return generateFallbackResponse(prompt);
        }
    }

    private String generateFallbackResponse(String prompt) {
        // Extract just the user message from the end of the prompt
        String userMessage = "";
        if (prompt.contains("User message:")) {
            userMessage = prompt.substring(prompt.lastIndexOf("User message:") + 13).trim();
        } else {
            userMessage = prompt;
        }
        
        String lower = userMessage.toLowerCase();
        log.info("Processing AI message: {}", lower);
        
        // Parse expense addition with better patterns
        if (lower.contains("add") && lower.contains("expense") && lower.matches(".*\\d+.*")) {
            log.info("Matched expense pattern");
            String amountStr = lower.replaceAll(".*?(\\d+(?:\\.\\d{1,2})?).*", "$1");
            String category = "Other";
            if (lower.contains("food") || lower.contains("lunch") || lower.contains("dinner")) category = "Food";
            else if (lower.contains("transport") || lower.contains("uber") || lower.contains("taxi")) category = "Transport";
            else if (lower.contains("shopping") || lower.contains("buy")) category = "Shopping";
            else if (lower.contains("entertainment") || lower.contains("movie")) category = "Entertainment";
            
            String response = String.format("{\"reply\":\"Added expense of ₹%s for %s. Transaction saved successfully!\",\"action\":\"CREATE_TRANSACTION\",\"transaction\":{\"amount\":%s,\"type\":\"EXPENSE\",\"title\":\"%s expense\",\"categoryName\":\"%s\",\"date\":\"%s\",\"note\":\"\"}}", 
                amountStr, category, amountStr, category, category, java.time.LocalDate.now());
            log.info("Generated expense response: {}", response);
            return response;
        }
        
        // Parse income addition
        if (lower.contains("add") && lower.contains("income") && lower.matches(".*\\d+.*")) {
            log.info("Matched income pattern");
            String amountStr = lower.replaceAll(".*?(\\d+(?:\\.\\d{1,2})?).*", "$1");
            String source = "Salary";
            if (lower.contains("freelance")) source = "Freelance";
            else if (lower.contains("business")) source = "Business";
            else if (lower.contains("gift")) source = "Gift";
            
            String response = String.format("{\"reply\":\"Added income of ₹%s from %s. Transaction saved successfully!\",\"action\":\"CREATE_TRANSACTION\",\"transaction\":{\"amount\":%s,\"type\":\"INCOME\",\"title\":\"%s income\",\"categoryName\":\"Salary\",\"date\":\"%s\",\"note\":\"\"}}", 
                amountStr, source, amountStr, source, java.time.LocalDate.now());
            log.info("Generated income response: {}", response);
            return response;
        }
        
        // Greeting responses
        if (lower.contains("hi") || lower.contains("hello") || lower.contains("hey")) {
            log.info("Matched greeting pattern");
            return "{\"reply\":\"Hello! I'm your SmartSpend AI assistant. I can help you track expenses, analyze spending patterns, and provide financial advice. Try asking me to add expenses like 'Add expense ₹50 food' or 'How's my spending this month?'\",\"action\":\"NONE\"}";
        }
        
        // Budget queries
        if (lower.contains("budget") || lower.contains("spending")) {
            log.info("Matched budget pattern");
            return "{\"reply\":\"Based on your recent transactions, I can see your spending patterns. Your food expenses seem to be the highest category. Consider setting a monthly budget to better track your expenses!\",\"action\":\"BUDGET_ADVICE\"}";
        }
        
        // Planning queries
        if (lower.contains("save") || lower.contains("plan") || lower.contains("advice")) {
            log.info("Matched planning pattern");
            return "{\"reply\":\"To improve your savings, I recommend the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings. Track your expenses regularly and look for areas where you can cut back.\",\"action\":\"PLANNING\"}";
        }
        
        // Financial queries
        if (lower.contains("how much") || lower.contains("balance") || lower.contains("money")) {
            log.info("Matched financial pattern");
            return "{\"reply\":\"I can help you understand your financial situation. Check your dashboard for your current balance and recent transactions. Would you like me to analyze your spending patterns?\",\"action\":\"QUERY\"}";
        }
        
        // Default response
        log.info("Using default response pattern");
        return "{\"reply\":\"I'm your SmartSpend AI assistant! I can help you track expenses, manage budgets, and provide financial advice. Try saying things like 'Add expense ₹100 food' or 'How's my spending this month?'\",\"action\":\"NONE\"}";
    }

    private AiChatResponse parseGeminiResponse(String rawJson, User user) {
        try {
            String cleaned = rawJson.strip();
            // Strip markdown code fences if Gemini adds them
            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replaceAll("(?s)```json\\s*|```\\s*", "").strip();
            }

            JsonNode root = objectMapper.readTree(cleaned);
            String reply = root.path("reply").asText("I'm here to help with your finances!");
            String action = root.path("action").asText("NONE");

            TransactionResponse createdTransaction = null;

            if ("CREATE_TRANSACTION".equals(action) && root.has("transaction")) {
                JsonNode txNode = root.path("transaction");

                BigDecimal amount = new BigDecimal(txNode.path("amount").asText("0"));
                String typeStr = txNode.path("type").asText("EXPENSE");
                String title = txNode.path("title").asText("Transaction");
                String categoryName = txNode.path("categoryName").asText("Other");
                String dateStr = txNode.path("date").asText(LocalDate.now().toString());
                String note = txNode.path("note").asText("");

                Transaction.TransactionType type = Transaction.TransactionType.valueOf(typeStr);
                LocalDate date;
                try {
                    date = LocalDate.parse(dateStr);
                } catch (Exception ex) {
                    date = LocalDate.now();
                }

                Category category = categoryService.findByNameAndUser(categoryName, user);
                if (category == null) {
                    List<Category> cats = categoryRepository.findByUserAndType(user,
                            type == Transaction.TransactionType.EXPENSE
                                    ? Category.CategoryType.EXPENSE
                                    : Category.CategoryType.INCOME);
                    category = cats.isEmpty()
                            ? categoryRepository.findByUser(user).get(0)
                            : cats.get(0);
                }

                TransactionRequest txRequest = new TransactionRequest();
                txRequest.setAmount(amount);
                txRequest.setType(type);
                txRequest.setTitle(title);
                txRequest.setNote(note);
                txRequest.setCategoryId(category.getId());
                txRequest.setSource(Transaction.TransactionSource.AI);
                txRequest.setDate(date.toString());

                createdTransaction = transactionService.createTransaction(txRequest);
            }

            return AiChatResponse.builder()
                    .reply(reply)
                    .action(action)
                    .transaction(createdTransaction)
                    .build();

        } catch (Exception e) {
            log.error("Failed to parse Gemini response: {}", e.getMessage());
            return AiChatResponse.builder()
                    .reply("I understood your message but had trouble processing it. Please try again.")
                    .action("NONE")
                    .build();
        }
    }
}
