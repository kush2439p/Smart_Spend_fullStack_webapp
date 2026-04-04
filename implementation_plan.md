# SmartSpend — Full-Stack Integration Plan

Connect the React Native/Expo frontend (`Smart_Spend_Frontend/artifacts/smartspend`) with the Spring Boot backend (`smartspend`) by resolving API contract mismatches. The backend is already largely implemented; we just need to align the response shapes.

## Proposed Changes

### Backend — DTO & Endpoint Fixes

#### [MODIFY] [AuthResponse.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/dto/AuthResponse.java)
Wrap the user fields into a nested `UserDto` object so the response matches `{ token, user: { id, name, email, currency } }` as expected by the frontend.

#### [MODIFY] [AuthService.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/service/AuthService.java)
Update to populate the new `UserDto` nested object in the `AuthResponse`.

---

#### [MODIFY] [TransactionResponse.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/dto/TransactionResponse.java)
- Change `id` field from `Long` to `String` (serialize as string)
- Change `date` from `LocalDate` to ISO string `String`
- Add `category` field (String name, same as `categoryName`)
- Ensure `source` serializes as lowercase string (`"manual"`, `"ai"`, etc.)

#### [MODIFY] [TransactionController.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/controller/TransactionController.java)
- Change path variable `Long id` → `String id` and parse internally.
- Support `category` query param (string name) as an alias to filter by category name instead of ID.

---

#### [MODIFY] [DashboardResponse.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/dto/DashboardResponse.java)
- Add `spendingTrend` list (last 7 days `{ date: String, amount: double }`)
- Rename `budgetAlerts` shape to match `{ categoryName, percentage }`
- `DailyTotal`: rename fields to match frontend: `income` (Double), `expense` (Double)
- `MonthlyTotal`: add `month` as string (e.g. `"Oct"`) + `income` / `expense` fields
- `CategoryBreakdown`: rename `categoryName` → `category`, `totalAmount` → `amount`

#### [MODIFY] [DashboardService.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/service/DashboardService.java)
Update to compute `spendingTrend` (last 7 days), populate correct field names.

#### [MODIFY] [DashboardController.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/controller/DashboardController.java)
- Add `/api/analytics/monthly-comparison` endpoint (alias of `/api/analytics/monthly`)

---

#### [MODIFY] [CategoryResponse.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/dto/CategoryResponse.java)
- Change `id` from `Long` to `String`
- Add `transactionCount` (int) and `monthlyTotal` (double) fields

#### [MODIFY] [CategoryService.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/service/CategoryService.java)
Compute `transactionCount` and `monthlyTotal` when building `CategoryResponse`.

---

#### [MODIFY] [BudgetResponse.java](file:///d:/Study(Real)/smartspend/src/main/java/com/smartspend/dto/BudgetResponse.java)
- Change `id` and `categoryId` from `Long` to `String`

---

### Frontend — AuthContext Fix

#### [MODIFY] [AuthContext.tsx](file:///d:/Study(Real)/Smart_Spend_Frontend/artifacts/smartspend/context/AuthContext.tsx)
- Map the flat `AuthResponse` into the `User` object shape: `{ id: res.id?.toString(), name: res.name, email: res.email, currency: res.currency }`
- Remove mock-data fallback (or keep it only as last resort) so real API failures are reported to the user

#### [MODIFY] [api.ts](file:///d:/Study(Real)/Smart_Spend_Frontend/artifacts/smartspend/services/api.ts)
- The `BASE_URL` is already `http://localhost:8080/api` — no change needed (it's already correct for local dev)

---

## Verification Plan

### Manual Testing (after running both servers)

**Step 1 — Start Backend:**
```
cd d:\Study(Real)\smartspend
mvn spring-boot:run
```
Backend should start on `http://localhost:8080`.

**Step 2 — Start Frontend:**
```
cd d:\Study(Real)\Smart_Spend_Frontend\artifacts\smartspend
npx expo start
```
Or in the root workspace: ensure the Expo app targets `artifacts/smartspend`.

**Step 3 — Test flows:**
1. **Register** — open app → Register screen → fill name/email/password → submit → should land on Dashboard (not mock data)
2. **Login** — logout → login with same credentials → should work
3. **Add Transaction** — tap + → fill fields → save → verify it appears in transaction list
4. **Dashboard** — verify balance, income/expense numbers come from real data
5. **Categories** — navigate to Categories tab → should load from `/api/categories`
6. **Budgets** — navigate → create budget → verify it saves and loads back

### API Smoke Tests (with curl or Postman)
```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"password123"}'

# Should return: { "token": "...", "user": { "id": "...", "name": "...", "email": "...", "currency": "USD" } }
```
