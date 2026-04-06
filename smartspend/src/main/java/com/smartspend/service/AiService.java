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
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

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
        You are SmartSpend AI — a friendly, smart personal finance assistant. 
        You understand natural casual language, English AND Hinglish.

        === USER PROFILE ===
        Name: %s | Currency: %s | Today: %s
        Monthly Income this month: Rs.%s | Monthly Expenses: Rs.%s | Net Balance: Rs.%s

        === USER CATEGORIES ===
        %s

        === RECENT TRANSACTIONS (last 10) ===
        %s

        === YOUR CAPABILITIES ===
        1. LOG EXPENSES/INCOME from casual mentions:
           - "had lunch at mcdonalds for 250" → CREATE_TRANSACTION EXPENSE Food
           - "grabbed coffee 80" → CREATE_TRANSACTION EXPENSE Food
           - "paid 1200 for electricity" → CREATE_TRANSACTION EXPENSE Utilities
           - "got salary 45000" → CREATE_TRANSACTION INCOME Salary
           - "uber se gaya 150 laga" → CREATE_TRANSACTION EXPENSE Transport
           - "client ne 5000 diye" → CREATE_TRANSACTION INCOME Freelance
           - "bhai 200 ka pizza khaya" → CREATE_TRANSACTION EXPENSE Food

        2. ANSWER FINANCIAL QUESTIONS using the data above:
           - "how much did I spend this month" → use monthly expense data
           - "am I overspending" → compare income vs expenses
           - "what's my biggest expense" → look at recent transactions
           - "how's my budget" → give honest assessment

        3. HAVE NORMAL CONVERSATIONS:
           - Greetings: reply warmly
           - General advice: give practical financial tips
           - Anything else: be helpful like a friend

        === RULES ===
        - action must be one of: CREATE_TRANSACTION, QUERY, NONE
        - For CREATE_TRANSACTION always include the "transaction" object
        - For QUERY or NONE, omit the "transaction" field entirely
        - Reply must be friendly, short, conversational (1-3 sentences max)
        - Pick best matching category from the user's list above
        - Default date to today (%s) unless user specifies otherwise

        Respond ONLY with valid JSON, no markdown fences:
        {"reply":"...","action":"CREATE_TRANSACTION","transaction":{"amount":250,"type":"EXPENSE","title":"McDonald's Lunch","categoryName":"Food","date":"%s","note":""}}
        
        OR for queries/greetings:
        {"reply":"...","action":"NONE"}

        User message: %s
        """.formatted(
        user.getName(), user.getCurrency(), LocalDate.now(),
        monthlyIncome != null ? monthlyIncome.toPlainString() : "0",
        monthlyExpense != null ? monthlyExpense.toPlainString() : "0",
        totalBalance != null ? totalBalance.toPlainString() : "0",
        categoryList.isEmpty() ? "Food, Transport, Shopping, Entertainment, Education, Utilities, Other" : categoryList,
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
        String userMessage = "";
        if (prompt.contains("User message:")) {
            userMessage = prompt.substring(prompt.lastIndexOf("User message:") + 13).trim();
        } else {
            userMessage = prompt;
        }

        // Extract financial context from prompt for smarter replies
        String monthlyIncome = "0", monthlyExpense = "0";
        try {
            if (prompt.contains("Monthly Income this month:")) {
                String inc = prompt.substring(prompt.indexOf("Monthly Income this month:") + 26).split("\\|")[0].replace("Rs.", "").trim();
                monthlyIncome = inc;
            }
            if (prompt.contains("Monthly Expenses:")) {
                String exp = prompt.substring(prompt.indexOf("Monthly Expenses:") + 17).split("\\|")[0].replace("Rs.", "").trim();
                monthlyExpense = exp;
            }
        } catch (Exception ignored) {}

        String lower = userMessage.toLowerCase();

        // ── Detect any transaction mention (amount present + spending/income words) ──
        boolean hasAmount = lower.matches(".*\\b\\d+\\b.*");
        boolean isExpense = lower.matches(".*(spent|paid|bought|grabbed|had|ate|ordered|went|taken|dala|kiya|khaya|laga|liya|kharcha|expense|bill|fee|ticket|uber|ola|zomato|swiggy|amazon|flipkart|petrol|diesel|coffee|lunch|dinner|pizza|chai|groceries|shopping|medical|doctor|electricity|water|rent|recharge|phone|movie|gym|metro|bus|rickshaw|auto).*");
        boolean isIncome = lower.matches(".*(salary|received|got|earned|income|freelance|payment received|client|credited|mila|diye|diya|bonus|refund|cashback|dividend|interest|profit).*");

        if (hasAmount && isExpense && !isIncome) {
            String amountStr = lower.replaceAll(".*?\\b(\\d+(?:\\.\\d{1,2})?)\\b.*", "$1");
            String category = detectCategory(lower);
            String title = userMessage.length() > 40 ? userMessage.substring(0, 40) : userMessage;
            return String.format(
                "{\"reply\":\"Got it! Logged ₹%s as a %s expense. Every rupee counts! 💰\",\"action\":\"CREATE_TRANSACTION\",\"transaction\":{\"amount\":%s,\"type\":\"EXPENSE\",\"title\":\"%s\",\"categoryName\":\"%s\",\"date\":\"%s\",\"note\":\"\"}}",
                amountStr, category, amountStr, title.replace("\"", "'"), category, java.time.LocalDate.now());
        }

        if (hasAmount && isIncome) {
            String amountStr = lower.replaceAll(".*?\\b(\\d+(?:\\.\\d{1,2})?)\\b.*", "$1");
            String catName = lower.contains("salary") ? "Salary" : lower.contains("freelance") ? "Freelance" : "Other Income";
            String title = userMessage.length() > 40 ? userMessage.substring(0, 40) : userMessage;
            return String.format(
                "{\"reply\":\"Nice! Added ₹%s as income. Keep it up! 🎉\",\"action\":\"CREATE_TRANSACTION\",\"transaction\":{\"amount\":%s,\"type\":\"INCOME\",\"title\":\"%s\",\"categoryName\":\"%s\",\"date\":\"%s\",\"note\":\"\"}}",
                amountStr, amountStr, title.replace("\"", "'"), catName, java.time.LocalDate.now());
        }

        // ── Financial queries ──
        if (lower.matches(".*(how much|kitna|balance|spent this month|spending|expenses this month|income this month|left|bacha|bachi).*")) {
            return String.format(
                "{\"reply\":\"This month you've earned Rs.%s and spent Rs.%s. Your net balance is Rs.%s. How's that looking for you?\",\"action\":\"QUERY\"}",
                monthlyIncome, monthlyExpense,
                (int)(Double.parseDouble(monthlyIncome.isEmpty() ? "0" : monthlyIncome) - Double.parseDouble(monthlyExpense.isEmpty() ? "0" : monthlyExpense)));
        }

        if (lower.matches(".*(overspending|saving|save money|budget|plan|advice|tips|help me|guide).*")) {
            double inc = Double.parseDouble(monthlyIncome.isEmpty() ? "0" : monthlyIncome);
            double exp = Double.parseDouble(monthlyExpense.isEmpty() ? "0" : monthlyExpense);
            if (inc > 0 && exp > inc * 0.8) {
                return "{\"reply\":\"You're spending quite a lot relative to income this month! Try the 50/30/20 rule: 50% needs, 30% wants, 20% savings. I can help you track where it's going.\",\"action\":\"NONE\"}";
            }
            return "{\"reply\":\"Great question! The 50/30/20 rule works well — 50% for essentials, 30% for wants, 20% for savings. Tell me about any expense and I'll log it instantly!\",\"action\":\"NONE\"}";
        }

        // ── Greetings ──
        if (lower.matches(".*(hi|hello|hey|hii|helo|namaste|sup|what's up|howdy).*")) {
            return String.format(
                "{\"reply\":\"Hey there! 👋 I'm your SmartSpend AI. This month you've spent Rs.%s out of Rs.%s income. Just tell me about any expense or income and I'll log it for you!\",\"action\":\"NONE\"}",
                monthlyExpense, monthlyIncome);
        }

        // ── Thanks / acknowledgements ──
        if (lower.matches(".*(thank|thanks|great|awesome|nice|good|perfect|okay|ok|got it).*")) {
            return "{\"reply\":\"Anytime! 😊 Keep logging your expenses and I'll help you stay on track. What else can I help with?\",\"action\":\"NONE\"}";
        }

        // ── Default ──
        return "{\"reply\":\"I can log expenses, track income, and answer questions about your finances. Just say something like 'had lunch for 250' or 'how much did I spend this month?' 😊\",\"action\":\"NONE\"}";
    }

    private String detectCategory(String lower) {
        if (lower.matches(".*(food|lunch|dinner|breakfast|restaurant|cafe|coffee|chai|pizza|burger|zomato|swiggy|hotel|snack|eat|khaya|khana).*")) return "Food";
        if (lower.matches(".*(uber|ola|metro|bus|auto|rickshaw|taxi|cab|petrol|diesel|fuel|transport|travel|train|flight|gaya|aaya).*")) return "Transport";
        if (lower.matches(".*(amazon|flipkart|shopping|clothes|shoes|shirt|dress|bag|bought|shopped|mall|shop).*")) return "Shopping";
        if (lower.matches(".*(movie|netflix|spotify|game|entertainment|concert|event|fun|play).*")) return "Entertainment";
        if (lower.matches(".*(doctor|medicine|hospital|medical|pharmacy|health|clinic|chemist).*")) return "Healthcare";
        if (lower.matches(".*(electricity|water|gas|internet|wifi|phone|recharge|bill|utility).*")) return "Utilities";
        if (lower.matches(".*(school|college|book|course|education|fees|tuition|study).*")) return "Education";
        if (lower.matches(".*(hotel|flight|holiday|trip|vacation|tour|airbnb).*")) return "Travel";
        return "Other";
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
