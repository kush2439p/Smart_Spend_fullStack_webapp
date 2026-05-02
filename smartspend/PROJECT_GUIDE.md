# SmartSpend — Complete Project Guide

> A beginner-friendly walkthrough of the entire SmartSpend application: what every piece does, how the frontend talks to the backend, every library used, every feature explained from scratch, and the real-world problems we hit while building it.
>
> If you have **never written code before**, you can still follow this. Every keyword is defined the first time it appears.

---

## Table of Contents

1. [What SmartSpend Is](#1-what-smartspend-is)
2. [The Big Picture (How Everything Fits Together)](#2-the-big-picture-how-everything-fits-together)
3. [Glossary — Every Technical Word Defined](#3-glossary--every-technical-word-defined)
4. [The Backend (Spring Boot + Java)](#4-the-backend-spring-boot--java)
5. [The Frontend (React Native + Expo)](#5-the-frontend-react-native--expo)
6. [How the Frontend Calls the Backend (Step-by-Step)](#6-how-the-frontend-calls-the-backend-step-by-step)
7. [Authentication Flow (Login & Signup)](#7-authentication-flow-login--signup)
8. [Feature Deep-Dives](#8-feature-deep-dives)
   - [8.1 Receipt Scanner (Camera + AI)](#81-receipt-scanner-camera--ai)
   - [8.2 SMS Transaction Detector](#82-sms-transaction-detector)
   - [8.3 AI Insights & Chat](#83-ai-insights--chat)
   - [8.4 Charts & Analytics (SVG Graphs)](#84-charts--analytics-svg-graphs)
   - [8.5 Budgets & Notifications](#85-budgets--notifications)
   - [8.6 Audit Log](#86-audit-log)
   - [8.7 Email System (Brevo)](#87-email-system-brevo)
   - [8.8 Multi-Currency Support](#88-multi-currency-support)
   - [8.9 PDF Export](#89-pdf-export)
9. [Deployment (Where the App Lives)](#9-deployment-where-the-app-lives)
10. [Errors We Hit and How We Fixed Them](#10-errors-we-hit-and-how-we-fixed-them)
11. [File-by-File Reference](#11-file-by-file-reference)

---

## 1. What SmartSpend Is

SmartSpend is a **personal expense tracker** — like a smarter, faster version of paper-and-pen accounts. It runs as:

- A **mobile app on Android** (installed via APK file)
- A **web app** in any browser (hosted on Vercel)

Both versions share the **same backend** — meaning the same brain on the internet. Whether you log in from your phone or your laptop, you see the same data.

### What it does for users

- Tracks income and expenses across categories (Food, Transport, Shopping, etc.)
- **Scans paper receipts** with the camera and pulls out merchant, amount, and date using AI
- **Reads bank SMS messages** automatically and creates transactions
- Shows colourful charts and analytics so you understand where money goes
- Lets you set monthly budgets per category and warns you when you cross 80% spent
- Sends you an email when you're nearly over budget
- Supports multiple currencies (₹, $, €, £, etc.)
- Exports your records as a PDF report

---

## 2. The Big Picture (How Everything Fits Together)

```
   ┌─────────────────────────────┐         ┌──────────────────────────────┐
   │      FRONTEND (the "face")  │         │   BACKEND (the "brain")      │
   │                             │         │                              │
   │  Phone APK   +    Web app   │ ◄────►  │   Spring Boot Java server    │
   │  (Expo / React Native)      │  HTTPS  │   running on Railway         │
   │                             │  + JSON │                              │
   └─────────────────────────────┘         └──────────────┬───────────────┘
                                                          │
                                                          │ JDBC
                                                          ▼
                                            ┌──────────────────────────────┐
                                            │   MySQL DATABASE on Aiven    │
                                            │   (where data lives forever) │
                                            └──────────────────────────────┘

             External services the backend talks to:
             • Google Gemini AI (for receipt + SMS understanding)
             • Brevo (for sending emails)
```

### The flow in plain English

1. You tap a button on your phone (e.g. "Add Transaction").
2. The phone app builds a small JSON message and sends it over the internet to the backend (Railway).
3. The backend receives it, checks you are logged in (using your token), saves the data into the MySQL database, and replies with a confirmation message.
4. The phone app receives the confirmation and updates the screen.

That's the entire app, just repeated for every feature.

---

## 3. Glossary — Every Technical Word Defined

Before we go deeper, here are the words you'll see throughout this document:

| Word | Plain-English Meaning |
|---|---|
| **Frontend** | The part you see and tap — the app or website. |
| **Backend** | The hidden server on the internet that does the thinking and remembers your data. |
| **API** | A "menu" of things the backend knows how to do. The frontend orders from this menu. |
| **HTTP / HTTPS** | The language computers use to talk to each other over the internet. The "S" means encrypted/secure. |
| **JSON** | A simple text format like `{"name":"Coffee", "amount":150}`. Both frontend and backend can read it. |
| **Endpoint** | One specific item on the API menu. Example: `POST /transactions` means "add a transaction." |
| **Database** | A digital filing cabinet where all your data lives, even when the app is closed. |
| **MySQL** | A specific brand of database. It uses tables (like Excel sheets) to organise data. |
| **JPA / Hibernate** | A library that lets Java code save and read database rows without writing raw SQL. |
| **Spring Boot** | The Java framework we use to build the backend quickly. It handles routing, security, and database stuff for us. |
| **Maven (`pom.xml`)** | The "shopping list" file that tells the backend which libraries to download. |
| **JWT (JSON Web Token)** | A long random string the backend gives you when you log in. Your phone shows it on every request to prove "this is me". |
| **Bearer Token** | The way to send a JWT in a request: `Authorization: Bearer xxxxxxx`. |
| **CORS** | A browser security rule. The backend has to say "yes, my web app is allowed to call me." |
| **DTO (Data Transfer Object)** | A simple Java class that defines the shape of data going in or out (e.g. `TransactionRequest`). |
| **Entity** | A Java class that maps directly to a database table (e.g. `Transaction.java` ↔ the `transactions` table). |
| **Repository** | A Java class that knows how to read/write one entity to the database. |
| **Service** | A Java class that contains the *business rules* (e.g. "before saving a budget, check the user owns it"). |
| **Controller** | A Java class that exposes endpoints — it receives the HTTP request, asks the service to do work, and sends back a response. |
| **React Native** | A framework that lets us write the phone app in JavaScript instead of Java/Swift. |
| **Expo** | A toolkit on top of React Native that handles building APKs, hot-reloading during development, etc. |
| **TypeScript** | JavaScript with types added — catches typos before the app even runs. |
| **React Query** | A frontend library that caches API responses. When you delete a transaction, it knows to refresh the dashboard. |
| **AsyncStorage** | The phone's local notebook — stores small things like your login token, theme preference, etc. |
| **Gemini** | Google's AI service. We send it images of receipts or SMS text, it sends back structured data. |
| **Brevo** | A service that actually sends emails (verification, password reset, budget alerts). |
| **Railway** | A cloud company that runs our backend Java app 24/7 so it's always available. |
| **Vercel** | Another cloud company that hosts the web version of our frontend. |
| **Aiven** | A cloud company that runs our MySQL database. |
| **EAS (Expo Application Services)** | The service that builds the actual `.apk` file we install on Android phones. |
| **OTA (Over-the-Air) update** | Pushing a new JavaScript bundle to an installed app without re-installing the APK. |
| **SVG** | A vector image format. We draw charts as SVG shapes — they scale to any screen without blurring. |

---

## 4. The Backend (Spring Boot + Java)

The backend lives in the `smartspend/` folder. It is a **Spring Boot** application written in **Java 17**.

### 4.1 How the code is organised

```
smartspend/
└── src/main/java/com/smartspend/
    ├── SmartspendApplication.java   ← starts everything (the "main" function)
    ├── config/                      ← security, CORS, RestTemplate setup
    ├── controller/                  ← receives HTTP requests (the "menu")
    ├── service/                     ← business logic ("what to do")
    ├── repository/                  ← database access ("how to save/load")
    ├── model/ + entity/             ← Java versions of database tables
    ├── dto/                         ← shapes of data sent in & out
    ├── filter/                      ← runs on every request (e.g. JWT check)
    └── exception/                   ← tells the user when something is wrong
```

This pattern is called **layered architecture** — Controller → Service → Repository → Database. Each layer has one job, which makes the code easy to maintain.

### 4.2 The libraries we picked (from `pom.xml`) and why

| Library | What it gives us | Why we needed it |
|---|---|---|
| `spring-boot-starter-web` | A web server (Tomcat) and tools to define HTTP endpoints | Every API call needs this |
| `spring-boot-starter-security` | Login, password hashing, CORS rules, JWT support | Stops strangers seeing your data |
| `spring-boot-starter-data-jpa` | Database access without writing SQL by hand | Saves us hundreds of lines of code |
| `spring-boot-starter-validation` | Checks that incoming data is sensible (e.g. amount > 0) | Catches bad data at the door |
| `spring-boot-starter-mail` | Sending emails (older fallback) | Originally used SMTP before switching to Brevo |
| `mysql-connector-j` | Lets Java talk to MySQL | The database is MySQL on Aiven |
| `postgresql` | Lets Java talk to Postgres | Used for local Replit dev DB |
| `pdfbox` (Apache) | Reads text out of PDF files | If you upload a PDF receipt instead of a photo |
| `lombok` | Auto-generates getters/setters/constructors | Less boilerplate code |
| `jjwt-api`, `jjwt-impl`, `jjwt-jackson` | Creates and verifies JSON Web Tokens | Our login system uses JWT |
| `itextpdf` | Creates PDF files | The "Export your data as PDF" feature |
| `jackson-databind` | Converts Java objects ↔ JSON | Spring uses this automatically for every request/response |

### 4.3 The flow inside the backend (one request, traced)

When the phone sends `POST /api/transactions` with a new transaction:

1. **`JwtAuthFilter`** (in `filter/`) intercepts the request, reads the `Authorization: Bearer xxx` header, validates the token, and figures out which user is calling.
2. **`TransactionController.createTransaction()`** (in `controller/`) receives the JSON, converts it to a `TransactionRequest` DTO automatically.
3. **`TransactionService.createTransaction()`** (in `service/`) checks the rules (does the category exist? is the amount positive?), creates a `Transaction` entity, asks the repository to save it, and writes an audit log entry.
4. **`TransactionRepository.save()`** (in `repository/`) is generated by Spring Data JPA — it writes the row into the MySQL `transactions` table using SQL behind the scenes.
5. The service converts the saved entity back into a `TransactionResponse` DTO.
6. The controller returns it as JSON. The phone receives it.

Same pattern for every feature.

### 4.4 Important configuration files

- **`application.properties`** — database URL, Brevo keys, Gemini key, JWT secret. Reads from environment variables in production so secrets are never in source code.
- **`SecurityConfig.java`** — defines which endpoints are public (`/auth/login`, `/auth/register`) and which require login.
- **`WebConfig.java`** — sets up CORS so the Vercel website can talk to Railway.

---

## 5. The Frontend (React Native + Expo)

The frontend lives in `Smart_Spend_Frontend/artifacts/smartspend/`. Same code runs as an Android APK *and* as a web page, thanks to **Expo + React Native Web**.

### 5.1 How the code is organised

```
Smart_Spend_Frontend/artifacts/smartspend/
├── app/                          ← every screen of the app
│   ├── _layout.tsx               ← global wrapper (theme, auth, query client)
│   ├── login.tsx, register.tsx   ← auth screens
│   ├── (tabs)/                   ← bottom-tab screens
│   │   ├── index.tsx             ← Dashboard
│   │   ├── transactions.tsx      ← Transactions list with edit modal
│   │   ├── analytics.tsx         ← Charts & graphs
│   │   ├── ai.tsx                ← AI chat with Gemini
│   │   └── settings.tsx, profile.tsx
│   ├── add-transaction.tsx       ← add new tx
│   ├── budgets.tsx               ← set & view budgets
│   ├── receipt-scanner.tsx       ← camera + upload
│   ├── sms-scanner.tsx           ← read SMS inbox
│   └── categories.tsx
├── components/                   ← reusable widgets (Icon, Charts, etc.)
├── services/api.ts               ← THE bridge to the backend
├── context/AuthContext.tsx       ← logged-in user info, available app-wide
├── utils/                        ← small helpers (currency, dates)
├── constants/colors.ts           ← brand colours in one place
├── app.json + eas.json           ← Expo + build configuration
└── package.json                  ← list of frontend libraries
```

### 5.2 The libraries we picked and why

| Library | What it gives us |
|---|---|
| `expo` | The whole Expo toolkit — managed React Native projects |
| `expo-router` | Page-based navigation: each file in `app/` becomes a route |
| `react-native-svg` | Lets us draw charts (bar, pie, line) using SVG shapes |
| `expo-camera` | Camera access for the receipt scanner |
| `expo-image-manipulator` | Resize/compress photos before uploading (saves bandwidth, faster Gemini response) |
| `expo-image-picker` | Lets the user pick a photo from their gallery |
| `expo-document-picker` | Picks PDF files (for PDF receipts) |
| `expo-file-system` | Reads files into base64 for upload |
| `expo-linear-gradient` | Pretty gradient backgrounds on cards |
| `expo-haptics` | Vibration feedback on button taps |
| `expo-blur`, `expo-glass-effect` | iOS-style frosted backgrounds |
| `react-native-android-sms-listener` | Listens for incoming SMS in real time (Android only) |
| `react-native-get-sms-android` | Reads the existing SMS inbox in bulk (Android only) |
| `@react-native-async-storage/async-storage` | The phone's local notepad — JWT, theme, budget pause flag |
| `@tanstack/react-query` | Smart cache for API responses; handles refetching automatically |
| `react-native-gesture-handler` | Swipe gestures (swipe-to-delete on transaction cards) |
| `react-native-reanimated` | Smooth 60fps animations |
| `@react-navigation/bottom-tabs` | The bottom tab bar (Dashboard / Transactions / Analytics / AI / Settings) |
| `expo-router` | Routing system — each file under `app/` is automatically a screen |
| `zod` | Validates form input on the frontend |

---

## 6. How the Frontend Calls the Backend (Step-by-Step)

Every API call goes through one file: `services/api.ts`. This is the **only** place the frontend knows the backend URL. If we change the URL, we change one line.

### 6.1 The request helper

```typescript
async function request<T>(method, path, body?) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwtTokenFromAsyncStorage}`
  };
  const response = await fetch(`${BASE_URL}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(...);
  if (response.status === 204) return undefined;   // empty success
  return response.json();
}
```

What this does:

1. Reads the saved JWT from AsyncStorage.
2. Adds the `Authorization` header so the backend knows you're logged in.
3. Converts the body object to JSON.
4. Sends the HTTPS request to Railway.
5. If the backend returns an error code (4xx/5xx), throws an Error so the screen can show a message.
6. If success, returns the parsed JSON.

### 6.2 The grouped APIs

```typescript
export const transactionsApi = {
  getAll:  (...) => request("GET", "/transactions?..."),
  create:  (data) => request("POST", "/transactions", data),
  update:  (id, data) => request("PUT", `/transactions/${id}`, data),
  delete:  (id) => request("DELETE", `/transactions/${id}`),
};
export const dashboardApi = { getSummary: () => request("GET", "/dashboard/summary") };
export const budgetsApi = { ... };
export const aiApi = { ... };
// ... etc
```

Each screen imports just what it needs:

```typescript
import { transactionsApi } from "@/services/api";
const txs = await transactionsApi.getAll();
```

### 6.3 React Query — the "auto-refresher"

React Query wraps each fetch and caches the result. We give every cache a **key** like `["dashboardSummary"]`. When you delete a transaction, we tell React Query "the dashboardSummary is now stale" and it automatically refetches it. That's why your total balance updates the instant you delete a row.

```typescript
queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
```

---

## 7. Authentication Flow (Login & Signup)

```
1. User types email + password → Login screen
2. Frontend → POST /auth/login   { email, password }
3. Backend looks up user, checks BCrypt-hashed password
4. Backend creates a JWT (signed with JWT_SECRET) → returns { token, user }
5. Frontend saves token in AsyncStorage and the user in AuthContext
6. Every future request includes Authorization: Bearer <token>
7. Backend's JwtAuthFilter validates the token before letting the request through
8. If user logs out → AsyncStorage.removeItem("auth_token")
```

For email verification & password reset:
- A short-lived token is generated and emailed (via Brevo) as a clickable link
- The link opens a webpage served by the backend (`VerifyEmailWebController`, `ResetPasswordWebController`)
- The page calls the API with the token to confirm or set a new password

---

## 8. Feature Deep-Dives

### 8.1 Receipt Scanner (Camera + AI)

**Goal**: Snap a photo of a paper receipt → app reads merchant, amount, date, items → user confirms → saved as transaction.

**Frontend** (`receipt-scanner.tsx`):
1. Opens camera using `expo-camera` (or gallery via `expo-image-picker`).
2. Resizes & compresses the photo using `expo-image-manipulator` to **max 1400px wide @ 82% quality** (smaller = faster upload).
3. Converts the result to base64 (a long string of letters representing the image).
4. POSTs it to `/receipts/scan` with up to 2 retries if the network hiccups.

**Backend** (`ReceiptService.java` + `ReceiptController.java`):
1. Receives the base64 image.
2. If it's a PDF, uses **Apache PDFBox** to extract text first (printed receipts).
3. Otherwise, builds a request to **Google Gemini Vision** (model `gemini-1.5-flash`) with:
   - The image
   - A carefully crafted prompt asking for `{ merchant, amount, date, items, category }`
4. Sends to Gemini via `RestTemplate` with **55-second timeout** and **3 retries with backoff**.
5. Parses Gemini's JSON response.
6. Returns the structured data to the phone (does NOT save automatically — user confirms first).

**Key tuning learned the hard way**:
- `maxOutputTokens: 8192` (was 1024 — Gemini was truncating long item lists)
- `thinkingBudget: 0` (skip Gemini's slow internal reasoning, we don't need it for receipts)
- Image quality 82% / 1400px (was 700px / 55% — too blurry for Gemini to read)

### 8.2 SMS Transaction Detector

**Goal**: When your bank sends "Rs 250 debited from your account at SWIGGY", auto-create an Expense transaction.

**Frontend** (`sms-scanner.tsx`) — Android only:
1. Asks for `READ_SMS` permission using `PermissionsAndroid`.
2. Reads the entire SMS inbox using `react-native-get-sms-android`.
3. **Filters in two stages**:
   - **Stage 1 — bank keyword check**: must contain at least 2 banking words like `debited`, `credited`, `upi`, `hdfc`.
   - **Stage 2 — non-transaction filter**: 20+ regex patterns reject false positives:
     - OTPs (`\botp\b`, `one-time password`)
     - Balance alerts (`your balance is`, `available bal`)
     - Failed/declined transactions
     - Promotional links (`https://`)
     - KYC reminders, due dates, reward points
4. For SMS that pass both stages, runs `parseSmsFast()` — a regex-based parser that pulls out amount, merchant, type (income/expense), category.
5. For real-time monitoring, `react-native-android-sms-listener` watches incoming messages.
6. The user reviews the list and confirms → batched POST to `/transactions/bulk`.

**Backend** (`SmsService.java`):
- For *single* SMS pasted manually, the backend uses Gemini to parse with a prompt that demands `isTransaction: true|false` and returns null if it's not a real transaction.
- This is a safety net — frontend regex catches 95%, backend Gemini catches the rest.

**The famous "₹25,000 false positive" bug**: A balance notification "Your account balance is Rs 25,000" had the words `account` + `rs` (passes bank keyword check) and the amount regex grabbed 25,000. **Fix**: the new `NON_TRANSACTION_PATTERNS` list rejects any message matching balance/OTP/promo patterns *before* parsing.

### 8.3 AI Insights & Chat

**Frontend** (`(tabs)/ai.tsx`):
- Chat-style screen where you can ask "How much did I spend on food in March?" or "What's my biggest expense category?"
- Sends your message + your recent transactions to `/ai/chat`.

**Backend** (`AiService.java`):
- Builds a context from your last 30-90 days of transactions (anonymised — no personal info leaves).
- Sends to Gemini with a prompt explaining you are a personal finance assistant.
- Returns the answer as plain text.

`InsightService.java` runs scheduled analysis: detects unusual spending, suggests budget tweaks, finds duplicate transactions.

### 8.4 Charts & Analytics (SVG Graphs)

We use **`react-native-svg`** (works on web too) to draw all charts from scratch — no chart library needed.

- **Bar charts**: monthly comparison of income vs expense
- **Pie charts**: category breakdown of this month's spending
- **Line charts**: daily spending trend
- **Donut charts**: budget usage rings

The backend (`InsightController.java`, `DashboardController.java`) returns aggregated numbers (`{ category: "Food", total: 4500 }`). The frontend converts those numbers into SVG `<Path>` and `<Rect>` elements with calculated coordinates.

**Performance trick**: Analytics screen caches results for 90 seconds keyed by `"YYYY-M"`, so switching tabs doesn't re-hit the API.

### 8.5 Budgets & Notifications

**Per-category budgets** (`budgets.tsx` + `BudgetService.java`):
- User sets monthly limits per category (Food: ₹5000, Transport: ₹2000).
- Backend tracks spending vs limit. When a transaction pushes spending past 80%, the backend calls `EmailService.sendBudgetAlertEmail()`.

**Overall monthly budget** is stored locally in AsyncStorage (`@smartspend_overall_budget`) — it's a personal goal, not synced.

**Pause feature** also stored locally (`@smartspend_budgets_paused`) — when ON, the screen shows budgets as paused and skips alert calculations.

### 8.6 Audit Log

Every important action (create, update, delete a transaction; change a category; reset password) writes a row to the **`audit_logs`** table via `writeAuditLog()` in services. This gives us a tamper-evident trail of who did what and when. Useful for security and debugging user complaints.

```java
writeAuditLog(user, AuditLog.AuditAction.DELETE, "Transaction", id,
    "Deleted: " + tx.getTitle() + " ₹" + tx.getAmount());
```

### 8.7 Email System (Brevo)

**Why Brevo?** Free tier of 300 emails/day, simple HTTPS API, no SMTP headaches.

**`EmailService.java`** has methods like:
- `sendVerificationEmail()` — link to verify after signup
- `sendWelcomeEmail()` — after verification succeeds
- `sendPasswordResetEmail()` — reset link with 1-hour token
- `sendBudgetAlertEmail()` — when spending crosses 80%

All emails use **inline-styled HTML templates** (so they render correctly even if the email client blocks external CSS). Brevo's `/v3/smtp/email` endpoint accepts JSON; we send via `RestTemplate`.

To swap providers (e.g. if BREVO_API_KEY expires): generate a new key in Brevo dashboard, update `BREVO_API_KEY` env var on Railway, redeploy.

### 8.8 Multi-Currency Support

User picks a display currency in settings (₹ INR, $ USD, € EUR, £ GBP, etc.). All amounts are **stored in INR** in the database; the frontend converts them on display using `utils/currency.ts` (`convertFromINR()` and `getCurrencySymbol()`). Conversion rates are bundled in the app, refreshed periodically.

### 8.9 PDF Export

**`ExportService.java`** uses **iText 5** to build a PDF report with:
- A summary page (totals, top categories)
- A transactions table for the chosen date range
- Embedded charts (rendered server-side)

User taps Export → backend streams the PDF → phone saves it / shares it.

---

## 9. Deployment (Where the App Lives)

| Piece | Lives on | How it gets there |
|---|---|---|
| Backend (Spring Boot) | **Railway** | Push to GitHub → Railway auto-builds with Maven and restarts |
| Database (MySQL) | **Aiven** | Created once; backend connects via JDBC URL |
| Web frontend | **Vercel** | Push to GitHub → Vercel runs `expo export --platform web` and serves the result |
| Android APK | **EAS Build** | Run `eas build --platform android --profile preview` from `Smart_Spend_Frontend/artifacts/smartspend/` → EAS builds in the cloud → download `.apk` and install |

**Environment variables** (secrets) live in:
- Replit (for development)
- Railway dashboard (for production backend)
- EAS secrets (for production frontend builds)

Required vars: `DB_PASSWORD`, `JWT_SECRET`, `BREVO_API_KEY`, `GOOGLE_API_KEY` (for Gemini).

---

## 10. Errors We Hit and How We Fixed Them

A real diary of problems and fixes — useful for anyone debugging a similar build.

### 10.1 "Receipt scanner times out / returns empty result"

**Symptom**: Scanning a receipt sometimes failed silently or returned partial data.
**Root cause**: Backend `RestTemplate` had a 25-second read timeout; Gemini sometimes takes 30-50s for complex receipts. Also `maxOutputTokens` was 1024, so long item lists were truncated mid-JSON.
**Fix**:
- Backend: read timeout 25s → 55s, `maxOutputTokens` 1024 → 8192, added 3-retry loop with exponential backoff (1s, 2s, 4s).
- Frontend: image upload 700px @ 55% → 1400px @ 82% (clearer image), client-side wrapper retries the whole call up to 2 times with friendly status messages.

### 10.2 SMS scanner created phantom ₹25,000 transactions

**Symptom**: After scanning the SMS inbox, an income of ₹25,000 appeared that didn't exist.
**Root cause**: The SMS was actually a balance alert — "Your SBI account balance is Rs 25,000". It contained `account` + `rs ` (passes the 2-keyword filter) and the amount regex picked up 25,000.
**Fix**: Added `NON_TRANSACTION_PATTERNS` — 20+ regex rules that reject balance alerts, OTPs, failed transactions, promotional messages, KYC reminders, etc. *before* the amount parser runs. Also rewrote the backend Gemini prompt to require an explicit `isTransaction: true/false` field and reject anything where `amount <= 0`.

### 10.3 Budget screen showed fake budgets for 10 seconds on load

**Symptom**: When opening the Budgets tab, mock data flashed for ~10s before real data appeared.
**Root cause**: The screen initialised state with hard-coded sample budgets so the layout looked good in dev.
**Fix**: Removed the mock data. Added a loading skeleton (shimmer placeholders) that displays until the real API call returns. Also moved the "overall monthly budget" and "pause" flag into AsyncStorage so they survive app restarts.

### 10.4 Tap-to-edit a transaction did nothing on the web

**Symptom**: Pressing "Delete Transaction" in the bottom sheet on the web app only highlighted the text — nothing happened.
**Root cause**: React Native's `Alert.alert` with multiple buttons doesn't fire callbacks on web browsers (RN-Web limitation — only single-button alerts work).
**Fix**: Detect platform: on web use the browser's native `window.confirm()`; on Android keep `Alert.alert`. APK behaviour stays identical, web works.

### 10.5 Deleted transactions still appeared in Dashboard / Recents

**Symptom**: Delete worked, but the dashboard balance and recent transactions list still showed the deleted item until you pulled to refresh.
**Root cause**: The screen updated its own local state but never told React Query that the cached `dashboardSummary` and `transactions` queries were stale.
**Fix**: Added `queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] })` and `["transactions"]` after every mutation (delete, edit category, save note). Now the dashboard refreshes automatically and instantly.

### 10.6 Delete felt slow (1-2 second wait before row disappeared)

**Symptom**: Tap Delete → spinner → row finally vanishes.
**Root cause**: We awaited the network round-trip to Railway *before* updating the UI.
**Fix**: Switched to **optimistic UI**: snapshot the row, remove it from the list immediately, then call the API in the background. If the API fails, restore just that single row (functional state update — won't clobber any concurrent refresh that happened in between).

### 10.7 Race conditions in edit handlers (architect-flagged)

**Symptom**: If the user opened a transaction, started editing the note, then quickly opened a different transaction while the API call was in flight, the result could overwrite the wrong transaction.
**Root cause**: Handlers used `selectedTx.id` *after* the `await`, but `selectedTx` may have changed by then.
**Fix**: Capture `txId` (and `noteValue`) into local consts at the start of the handler, use them after the await. Then update only the row matching that captured id, ignoring whichever transaction is currently open.

### 10.8 Slow tab switching on Transactions screen

**Symptom**: Switching between All / Income / Expense tabs took ~600ms.
**Root cause**: Each tab fired its own filtered API call.
**Fix**: Fetch 500 transactions once, store in local state, filter client-side with `useMemo`. Now switching is instant.

### 10.9 CORS errors when web app called Railway

**Symptom**: Browser console: "Access to fetch ... blocked by CORS policy."
**Root cause**: The backend's `WebConfig` only allowed `localhost:5000`, not the Vercel domain.
**Fix**: Updated `addAllowedOriginPatterns(...)` to include `*.vercel.app` and the production custom domain.

### 10.10 JWT expired silently — user kept seeing blank screens

**Symptom**: After ~24 hours, every API call failed with 401 but no message.
**Root cause**: The frontend `request()` helper threw a generic error; auth screens didn't watch for 401s.
**Fix**: When a 401 is detected, automatically clear AsyncStorage and redirect to the login screen.

### 10.11 Camera works in dev but APK crashes on capture

**Symptom**: Camera screen shows in dev but APK closes when you press shutter.
**Root cause**: `expo-camera` requires native modules. Dev mode (Expo Go) had them; the APK we'd built earlier didn't.
**Fix**: Rebuild APK with `eas build --platform android --profile preview` after adding any native package (camera, SMS reader). JS-only changes don't need this.

### 10.12 SMS reader returned empty list despite messages existing

**Symptom**: User granted SMS permission, but inbox came back empty.
**Root cause**: `react-native-get-sms-android` requires *both* `READ_SMS` and `RECEIVE_SMS` permissions, and on Android 12+ also requires the app to be set as the default messaging app *only* if you want to write SMS — for read-only we just need `READ_SMS`. The app declared the permission in `app.json` but didn't request it at runtime.
**Fix**: Use `PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS)` before any SMS call.

---

## 11. File-by-File Reference

### Backend (`smartspend/`)

| File | What it does |
|---|---|
| `SmartspendApplication.java` | Entry point — boots Spring |
| `config/SecurityConfig.java` | Defines public vs protected endpoints, hooks JwtAuthFilter |
| `config/WebConfig.java` | CORS rules |
| `config/ApplicationConfig.java` | Defines beans (e.g. RestTemplate with timeouts) |
| `controller/AuthController.java` | `/auth/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify` |
| `controller/TransactionController.java` | CRUD endpoints for transactions |
| `controller/BudgetController.java` | Budget CRUD |
| `controller/CategoryController.java` | Category CRUD |
| `controller/DashboardController.java` | `/dashboard/summary` — totals, recents |
| `controller/InsightController.java` | Aggregated analytics for charts |
| `controller/ReceiptController.java` | `/receipts/scan` — receipt OCR |
| `controller/SmsController.java` | `/sms/parse` — single SMS parse via Gemini |
| `controller/AiController.java` | `/ai/chat` — chat with Gemini |
| `controller/ExportController.java` | `/export/pdf` — PDF report |
| `controller/RecurringController.java` | Recurring transactions |
| `controller/VerifyEmailWebController.java` | HTML page shown when user clicks email verify link |
| `controller/ResetPasswordWebController.java` | HTML page for password reset link |
| `controller/DevController.java` | Dev-only utilities (cleanup, seeders) |
| `service/AuthService.java` | Hashing, token generation, email verification logic |
| `service/JwtService.java` | Build & validate JWTs |
| `service/TransactionService.java` | Business rules + audit logs for transactions |
| `service/BudgetService.java` | Budget calculations, triggers email alerts |
| `service/CategoryService.java` | Category logic |
| `service/DashboardService.java` | Aggregates totals and recents |
| `service/InsightService.java` | Chart data, anomaly detection |
| `service/ReceiptService.java` | Calls Gemini Vision for receipt parsing |
| `service/SmsService.java` | Calls Gemini for single SMS parsing |
| `service/AiService.java` | Conversational AI |
| `service/EmailService.java` | All Brevo email sends |
| `service/ExportService.java` | iText PDF generation |
| `service/RecurringService.java` | Daily job to generate recurring tx |
| `repository/*.java` | One per entity — provides `save()`, `findById()`, custom queries |
| `model/*.java` or `entity/*.java` | `User`, `Transaction`, `Category`, `Budget`, `AuditLog`, etc. |
| `dto/*.java` | Request/response shapes |
| `filter/JwtAuthFilter.java` | Runs on every request — checks the JWT |
| `exception/*.java` | Custom exceptions and global handler that returns nice JSON errors |

### Frontend (`Smart_Spend_Frontend/artifacts/smartspend/`)

| File | What it does |
|---|---|
| `app/_layout.tsx` | Root layout: theme, fonts, AuthContext, QueryClient |
| `app/login.tsx`, `register.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx` | Auth flow screens |
| `app/onboarding.tsx` | First-run intro slides |
| `app/(tabs)/index.tsx` | Dashboard (totals, recents, quick actions) |
| `app/(tabs)/transactions.tsx` | List + filter + tap-to-edit modal |
| `app/(tabs)/analytics.tsx` | All charts |
| `app/(tabs)/ai.tsx` | Chat with Gemini |
| `app/(tabs)/settings.tsx` | Profile, currency, theme |
| `app/(tabs)/profile.tsx` | User info, logout |
| `app/add-transaction.tsx` | Manual add form |
| `app/budgets.tsx` | Per-category & overall budgets |
| `app/receipt-scanner.tsx` | Camera + AI receipt scan |
| `app/sms-scanner.tsx` | SMS inbox scan |
| `app/categories.tsx` | Manage categories |
| `services/api.ts` | The single bridge to the backend — every endpoint lives here |
| `context/AuthContext.tsx` | Logged-in user state |
| `utils/currency.ts` | Symbol + conversion helpers |
| `utils/dates.ts` | Date formatting, week/month helpers |
| `constants/colors.ts` | Brand palette |
| `components/Icon.tsx` | Wrapper around emoji + vector icons |
| `eas.json` | Build profiles for EAS |
| `app.json` | Expo configuration (permissions, splash, icons) |
| `package.json` | Frontend libraries |

---

## Closing Note

That's the entire SmartSpend system, top to bottom. The tech choices weren't random:

- **Spring Boot** because it removes 90% of the boilerplate of a Java web server.
- **React Native + Expo** because one codebase becomes both an Android APK *and* a web app.
- **MySQL on Aiven + Railway** because they have generous free tiers and just work.
- **Gemini** for AI because it has a free tier and handles both vision (receipts) and text (SMS, chat).
- **Brevo** for email because no SMTP setup is needed — just an API key.

Every error in section 10 was a real lesson learned. If you're starting a similar project, expect to meet most of these problems too. Now you have a head start.
