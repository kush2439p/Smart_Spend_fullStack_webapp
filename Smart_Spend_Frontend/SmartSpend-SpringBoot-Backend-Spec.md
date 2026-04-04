# SmartSpend — Spring Boot Backend Specification

## Overview

This document describes every API endpoint the SmartSpend mobile app (React Native / Expo) expects. Build this in Spring Boot and replace the `BASE_URL` in `artifacts/smartspend/services/api.ts` with your server URL.

---

## Base Configuration

```
Base URL: http://localhost:8080/api
All protected routes require: Authorization: Bearer <JWT>
Content-Type: application/json (unless multipart)
```

---

## 1. Authentication

### POST /api/auth/register
Creates a new user account and returns a JWT.

**Request Body:**
```json
{
  "name": "Sarah Jenkins",
  "email": "sarah@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "1",
    "name": "Sarah Jenkins",
    "email": "sarah@example.com",
    "currency": "USD"
  }
}
```

---

### POST /api/auth/login
Authenticates user and returns a JWT.

**Request Body:**
```json
{
  "email": "sarah@example.com",
  "password": "password123"
}
```

**Response 200:** Same as register.

**Error 401:**
```json
{ "message": "Invalid credentials" }
```

---

### POST /api/auth/logout
Invalidates token (optional — stateless JWT can skip this).

**Headers:** `Authorization: Bearer <token>`

**Response 200:** `{}`

---

## 2. Dashboard

### GET /api/dashboard/summary
Returns the full dashboard overview for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response 200:**
```json
{
  "totalBalance": 24562.00,
  "monthlyIncome": 8240.50,
  "monthlyExpense": 3120.00,
  "recentTransactions": [ /* last 5 Transaction objects */ ],
  "budgetAlerts": [
    { "categoryName": "Shopping", "percentage": 93.3 },
    { "categoryName": "Food & Dining", "percentage": 80.0 }
  ],
  "spendingTrend": [
    { "date": "Mon", "amount": 45.0 },
    { "date": "Tue", "amount": 120.0 },
    { "date": "Wed", "amount": 30.0 },
    { "date": "Thu", "amount": 200.0 },
    { "date": "Fri", "amount": 85.0 },
    { "date": "Sat", "amount": 160.0 },
    { "date": "Sun", "amount": 70.0 }
  ]
}
```

---

## 3. Transactions

### GET /api/transactions
Returns paginated list of transactions for the authenticated user.

**Query Params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | int | 0 | Page number (0-indexed) |
| size | int | 20 | Items per page |
| type | string | null | Filter: `income` or `expense` |
| category | string | null | Filter by category name |
| startDate | string | null | ISO date string |
| endDate | string | null | ISO date string |

**Response 200:**
```json
{
  "content": [
    {
      "id": "abc123",
      "title": "Starbucks Coffee",
      "amount": 6.50,
      "type": "expense",
      "category": "Food & Dining",
      "categoryIcon": "🍕",
      "categoryColor": "#FF6B6B",
      "date": "2026-03-24T10:30:00Z",
      "note": "Morning coffee",
      "source": "manual"
    }
  ],
  "totalElements": 42,
  "totalPages": 3,
  "number": 0
}
```

**`source` field values:** `manual`, `ai`, `receipt`, `sms`

---

### POST /api/transactions
Creates a new transaction.

**Request Body:**
```json
{
  "title": "Starbucks Coffee",
  "amount": 6.50,
  "type": "expense",
  "category": "Food & Dining",
  "date": "2026-03-24T10:30:00Z",
  "note": "Optional note"
}
```

**Response 201:** Full Transaction object (same as GET item above)

---

### GET /api/transactions/{id}
Returns a single transaction by ID.

**Response 200:** Transaction object

**Response 404:** `{ "message": "Transaction not found" }`

---

### DELETE /api/transactions/{id}
Deletes a transaction.

**Response 204:** No content

---

## 4. Categories

### GET /api/categories
Returns all categories for the user (system defaults + user-created).

**Response 200:**
```json
[
  {
    "id": "1",
    "name": "Food & Dining",
    "type": "expense",
    "icon": "🍕",
    "color": "#FF6B6B",
    "transactionCount": 12,
    "monthlyTotal": 320.00
  }
]
```

**`type` field values:** `income`, `expense`, `both`

---

### POST /api/categories
Creates a new category.

**Request Body:**
```json
{
  "name": "Coffee Shops",
  "type": "expense",
  "icon": "☕",
  "color": "#FF6B6B"
}
```

**Response 201:** Full Category object

---

### DELETE /api/categories/{id}
Deletes a user-created category.

**Response 204:** No content

---

## 5. Budgets

### GET /api/budgets
Returns all budget goals for the current month.

**Response 200:**
```json
[
  {
    "id": "1",
    "categoryId": "1",
    "categoryName": "Food & Dining",
    "categoryIcon": "🍕",
    "categoryColor": "#FF6B6B",
    "limitAmount": 400.00,
    "spentAmount": 320.00,
    "percentage": 80.0
  }
]
```

---

### POST /api/budgets
Creates a new budget goal.

**Request Body:**
```json
{
  "categoryId": "1",
  "limitAmount": 400.00
}
```

**Response 201:** Full Budget object

---

### PUT /api/budgets/{id}
Updates a budget goal.

**Request Body:** (partial)
```json
{
  "limitAmount": 500.00
}
```

**Response 200:** Full Budget object

---

### DELETE /api/budgets/{id}
Deletes a budget goal.

**Response 204:** No content

---

## 6. Analytics

### GET /api/analytics/daily
Returns daily income/expense breakdown for a given month.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| month | int | Month (1-12) |
| year | int | Year (e.g. 2026) |

**Response 200:**
```json
[
  { "date": "2026-03-01", "income": 0.0, "expense": 45.50 },
  { "date": "2026-03-02", "income": 5000.0, "expense": 120.00 }
]
```

---

### GET /api/analytics/category-breakdown
Returns expense breakdown by category for the current month.

**Response 200:**
```json
[
  {
    "category": "Food & Dining",
    "icon": "🍕",
    "color": "#FF6B6B",
    "amount": 320.00,
    "percentage": 32.0
  }
]
```

---

### GET /api/analytics/monthly-comparison
Returns income vs expense for the last 6 months.

**Response 200:**
```json
[
  { "month": "Sep", "income": 6200.0, "expense": 4100.0 },
  { "month": "Oct", "income": 7100.0, "expense": 3800.0 }
]
```

---

## 7. AI Chat

### POST /api/ai/chat
Sends a natural language message and receives an AI response (optionally creating a transaction).

**Request Body:**
```json
{
  "message": "spent 200 on food today",
  "conversationId": "optional-uuid-for-context"
}
```

**Response 200:**
```json
{
  "message": "Got it! I've logged a $200 expense in Food & Dining for today.",
  "transactionCreated": {
    "id": "new-tx-id",
    "title": "Food expense",
    "amount": 200.0,
    "type": "expense",
    "category": "Food & Dining",
    "categoryIcon": "🍕",
    "categoryColor": "#FF6B6B",
    "date": "2026-03-24T00:00:00Z",
    "source": "ai"
  },
  "conversationId": "abc-uuid-123"
}
```

**Note:** `transactionCreated` is `null` if no transaction was created (e.g. query about balance).

**Suggested AI backend approach:**
- Use OpenAI GPT-4o or similar
- Parse the user's message to detect intent: `ADD_EXPENSE`, `ADD_INCOME`, `QUERY_BALANCE`, `QUERY_SPENDING`, `BUDGET_STATUS`
- For `ADD_*` intents: extract amount, category, date from message → create transaction → return it in response

---

## 8. Receipt Scanner

### POST /api/receipts/scan
Uploads a receipt image and returns parsed data.

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Description |
|-------|------|-------------|
| image | File | JPEG/PNG receipt image |

**Response 200:**
```json
{
  "amount": 36.50,
  "merchant": "Starbucks Coffee",
  "date": "2026-03-24",
  "suggestedCategory": "Food & Dining"
}
```

**Suggested approach:**
- Use OpenAI Vision API (GPT-4o with image input) or Google Cloud Vision API
- Pass image as base64 with prompt: "Extract: total amount, merchant name, date. Return JSON."
- Map merchant name to category using a lookup table or AI classification

---

## 9. SMS Parsing

### POST /api/sms/parse
Parses a raw SMS message and extracts a transaction if detected.

**Request Body:**
```json
{
  "message": "Your account has been debited Rs. 500 for UPI payment to Zomato on 24-Mar-26",
  "sender": "HDFCBK"
}
```

**Response 200 (transaction found):** Full Transaction object with `source: "sms"`

**Response 200 (no transaction):** `null`

**Keywords to detect:** `debited`, `credited`, `Rs.`, `INR`, `paid`, `received`, `withdrawn`

---

## 10. Insights

### GET /api/insights
Returns an AI-generated insight summary text.

**Response 200:**
```json
{
  "text": "Last week, you spent a total of $422.00. The biggest categories were Food & Dining ($185.00) and Going Out ($140.50)."
}
```

---

## 11. Export

### GET /api/export
Exports user data as PDF or Excel.

**Query Params:**
| Param | Type | Description |
|-------|------|-------------|
| format | string | `pdf` or `excel` |

**Response 200:**
```json
{
  "downloadUrl": "https://your-server.com/downloads/export-abc123.pdf"
}
```

---

## Database Schema (Suggested)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  sms_parsing_enabled BOOLEAN DEFAULT true,
  email_parsing_enabled BOOLEAN DEFAULT false,
  budget_alerts_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon VARCHAR(10) NOT NULL,
  color VARCHAR(20) NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
  date TIMESTAMP NOT NULL,
  note TEXT,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'receipt', 'sms')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  limit_amount DECIMAL(12, 2) NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category_id, month, year)
);

-- AI Conversations (optional, for context)
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Spring Boot Project Setup

### Dependencies (pom.xml)
```xml
<dependencies>
  <!-- Spring Web -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
  </dependency>

  <!-- Spring Security + JWT -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
  </dependency>
  <dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.3</version>
  </dependency>
  <dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.3</version>
  </dependency>

  <!-- JPA + PostgreSQL -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
  </dependency>
  <dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
  </dependency>

  <!-- Multipart (for receipt) -->
  <!-- Built into Spring Web -->

  <!-- OpenAI (for AI Chat & Receipt) -->
  <dependency>
    <groupId>com.theokanning.openai-gpt3-java</groupId>
    <artifactId>service</artifactId>
    <version>0.18.2</version>
  </dependency>

  <!-- Validation -->
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
  </dependency>
</dependencies>
```

### application.properties
```properties
server.port=8080
spring.datasource.url=jdbc:postgresql://localhost:5432/smartspend
spring.datasource.username=postgres
spring.datasource.password=yourpassword
spring.jpa.hibernate.ddl-auto=update

jwt.secret=your-256-bit-secret-key-here
jwt.expiration=86400000

openai.api.key=${OPENAI_API_KEY}

spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB

# CORS — allow mobile app connections
spring.web.cors.allowed-origins=*
spring.web.cors.allowed-methods=GET,POST,PUT,DELETE,OPTIONS
spring.web.cors.allowed-headers=*
```

---

## Authentication Flow

```
1. User registers → POST /auth/register → gets JWT
2. JWT stored in AsyncStorage on mobile
3. Every API call sends: Authorization: Bearer <JWT>
4. Spring Security filter validates JWT on each request
5. Extract userId from JWT claims → use in all queries
```

### JWT Filter (pseudocode)
```java
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, ...) {
        String token = req.getHeader("Authorization").replace("Bearer ", "");
        String userId = jwtService.extractUserId(token);
        // Set SecurityContext with userId
    }
}
```

---

## Connecting the Frontend

In `artifacts/smartspend/services/api.ts`, change line 7:

```typescript
// Before (mock):
export const BASE_URL = "http://localhost:8080/api";

// After (production — use your actual Spring Boot server URL):
export const BASE_URL = "https://your-spring-boot-server.com/api";
```

The auth token is automatically attached to every request via `getAuthHeaders()`. No other changes needed in the frontend code.

---

## Error Response Format

All error responses should follow this format:
```json
{
  "message": "Human-readable error message",
  "status": 400,
  "timestamp": "2026-03-24T10:30:00Z"
}
```

Common HTTP status codes:
| Code | When |
|------|------|
| 200 | Success |
| 201 | Created |
| 204 | Deleted |
| 400 | Validation error |
| 401 | Unauthorized / bad token |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Server error |
