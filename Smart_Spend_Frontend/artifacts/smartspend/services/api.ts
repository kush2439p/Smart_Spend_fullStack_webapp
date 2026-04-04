import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

// ============================================================
// BASE URL — used by the phone to reach your backend.
// On Replit, the backend is proxied through the dev domain.
// ============================================================
export const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}:8080/api`
  : "http://localhost:8080/api";

// ============================================================
// HTTP Helper
// ============================================================
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function getPublicHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

async function publicRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getPublicHeaders();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// Auth Endpoints  →  POST /auth/login, POST /auth/register
// ============================================================
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/login", { email, password }),

  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>("POST", "/auth/register", { name, email, password }),

  verifyEmail: (token: string) =>
    publicRequest<{ message: string }>("GET", `/auth/verify?token=${token}`),

  forgotPassword: (email: string) =>
    publicRequest<{ message: string }>("POST", "/auth/forgot-password", { email }),
    
  resetPassword: (token: string, newPassword: string) =>
    publicRequest<{ message: string }>("POST", "/auth/reset-password", { token, newPassword }),
    
  resendVerification: (email: string) =>
    publicRequest<{ message: string }>("POST", "/auth/resend-verification", { email }),

  logout: () => request<void>("POST", "/auth/logout"),
};

// ============================================================
// Dashboard  →  GET /dashboard/summary
// ============================================================
export const dashboardApi = {
  getSummary: () => request<DashboardSummary>("GET", "/dashboard/summary"),
};

// ============================================================
// Transactions  →  GET /transactions, POST /transactions, DELETE /transactions/:id
// ============================================================
export const transactionsApi = {
  getAll: (params?: { page?: number; size?: number; type?: string; category?: string }) => {
    const query = new URLSearchParams();
    if (params?.page !== undefined) query.append("page", String(params.page));
    if (params?.size !== undefined) query.append("size", String(params.size));
    if (params?.type) query.append("type", params.type);
    if (params?.category) query.append("category", params.category);
    return request<{ content: Transaction[]; totalElements: number }>("GET", `/transactions?${query}`);
  },

  create: (data: CreateTransactionRequest) =>
    request<Transaction>("POST", "/transactions", data),

  delete: (id: string) => request<void>("DELETE", `/transactions/${id}`),

  getById: (id: string) => request<Transaction>("GET", `/transactions/${id}`),
};

// ============================================================
// Categories  →  GET /categories, POST /categories
// ============================================================
export const categoriesApi = {
  getAll: () => request<Category[]>("GET", "/categories"),
  create: (data: CreateCategoryRequest) => request<Category>("POST", "/categories", data),
  delete: (id: string) => request<void>("DELETE", `/categories/${id}`),
};

// ============================================================
// Budgets  →  GET /budgets, POST /budgets, DELETE /budgets/:id
// ============================================================
export const budgetsApi = {
  getAll: () => request<Budget[]>("GET", "/budgets"),
  create: (data: CreateBudgetRequest) => request<Budget>("POST", "/budgets", data),
  update: (id: string, data: Partial<CreateBudgetRequest>) =>
    request<Budget>("PUT", `/budgets/${id}`, data),
  delete: (id: string) => request<void>("DELETE", `/budgets/${id}`),
};

// ============================================================
// Analytics  →  GET /analytics/daily, GET /analytics/category-breakdown
// ============================================================
export const analyticsApi = {
  getDaily: (month: number, year: number) =>
    request<DailyAnalytics[]>("GET", `/analytics/daily?month=${month}&year=${year}`),
  getCategoryBreakdown: () =>
    request<CategoryBreakdown[]>("GET", "/analytics/category-breakdown"),
  getMonthlyComparison: () =>
    request<MonthlyComparison[]>("GET", "/analytics/monthly-comparison"),
};

// ============================================================
// AI Chat  →  POST /ai/chat
// ============================================================
export const aiApi = {
  chat: (message: string) => request<AiChatResponse>("POST", "/ai/chat", { message }),
  getInsights: () => request<string>("GET", "/insights"),
};

// ============================================================
// Receipt Scanner  →  POST /receipts/scan (multipart)
// ============================================================
export const receiptApi = {
  scan: async (fileUri: string, mimeType: string = "image/jpeg"): Promise<ReceiptScanResult> => {
    const token = await AsyncStorage.getItem("auth_token");
    const formData = new FormData();
    const isPdf = mimeType === "application/pdf";
    const fileName = isPdf ? "receipt.pdf" : "receipt.jpg";

    if (typeof window !== "undefined" && fileUri.startsWith("blob:")) {
      // Web: fetch the blob and append it directly
      const blobRes = await fetch(fileUri);
      const blob = await blobRes.blob();
      formData.append("file", blob, fileName);
    } else {
      // Native (React Native): use the URI object form
      formData.append("file", {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as unknown as Blob);
    }

    const response = await fetch(`${BASE_URL}/receipts/scan`, {
      method: "POST",
      headers: {
        // Do NOT set Content-Type — browser must set it with multipart boundary
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || "Receipt scan failed");
    }
    return response.json();
  },
};

// ============================================================
// SMS Parsing  →  POST /sms/parse
// ============================================================
export const smsApi = {
  // Backend expects { text, timestamp? }. We keep signature simple for now.
  parse: (text: string, timestamp?: string) =>
    request<Transaction | null>("POST", "/sms/parse", { text, timestamp }),
};

// ============================================================
// Export  →  GET /export?format=pdf|excel
// ============================================================
export const exportApi = {
  // Backend returns raw bytes for PDF/CSV.
  // On mobile, easiest UX is to open the download URL in the browser.
  export: async (format: "pdf" | "excel") => {
    const path = format === "pdf" ? "/export/pdf" : "/export/csv";
    const url = `${BASE_URL}${path}`;
    await Linking.openURL(url);
  },
};

// ============================================================
// Types
// ============================================================
export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  avatar?: string;
  emailVerified?: boolean;
}

export interface DashboardSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  summaryMonth: number;
  summaryYear: number;
  recentTransactions: Transaction[];
  budgetAlerts: BudgetAlert[];
  spendingTrend: { date: string; amount: number }[];
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  categoryIcon: string;
  categoryColor: string;
  date: string;
  note?: string;
  source: "manual" | "ai" | "receipt" | "sms";
}

export interface CreateTransactionRequest {
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense" | "both";
  icon: string;
  color: string;
  transactionCount: number;
  monthlyTotal: number;
}

export interface CreateCategoryRequest {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limitAmount: number;
  spentAmount: number;
  percentage: number;
}

export interface BudgetAlert {
  categoryName: string;
  percentage: number;
}

export interface CreateBudgetRequest {
  categoryId: string;
  limitAmount: number;
}

export interface DailyAnalytics {
  date: string;
  income: number;
  expense: number;
}

export interface CategoryBreakdown {
  category: string;
  icon: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface MonthlyComparison {
  month: string;
  income: number;
  expense: number;
}

export interface AiChatResponse {
  reply: string;
  action: string;
  transaction?: Transaction;
}

export interface ReceiptScanResult {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  suggestedCategory: string;
  type?: "expense" | "income";
  items?: string[];
  currency?: string;
  notes?: string;
  error?: string;
}
