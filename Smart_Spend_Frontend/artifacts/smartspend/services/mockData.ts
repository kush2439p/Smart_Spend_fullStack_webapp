import {
  DashboardSummary,
  Transaction,
  Category,
  Budget,
  DailyAnalytics,
  CategoryBreakdown,
  MonthlyComparison,
} from "./api";

export const MOCK_USER = {
  id: "1",
  name: "Sarah Jenkins",
  email: "sarah@example.com",
  currency: "USD",
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    title: "Starbucks Coffee",
    amount: 6.5,
    type: "expense",
    category: "Food & Dining",
    categoryIcon: "🍕",
    categoryColor: "#FF6B6B",
    date: new Date().toISOString(),
    source: "manual",
  },
  {
    id: "2",
    title: "Monthly Salary",
    amount: 5000,
    type: "income",
    category: "Salary",
    categoryIcon: "💼",
    categoryColor: "#00C897",
    date: new Date(Date.now() - 86400000).toISOString(),
    source: "manual",
  },
  {
    id: "3",
    title: "Uber Ride",
    amount: 12.4,
    type: "expense",
    category: "Transport",
    categoryIcon: "🚗",
    categoryColor: "#4ECDC4",
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    source: "sms",
  },
  {
    id: "4",
    title: "Amazon Shopping",
    amount: 89.99,
    type: "expense",
    category: "Shopping",
    categoryIcon: "🛍️",
    categoryColor: "#FFE66D",
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    source: "receipt",
  },
  {
    id: "5",
    title: "Netflix",
    amount: 15.99,
    type: "expense",
    category: "Entertainment",
    categoryIcon: "🎬",
    categoryColor: "#FD79A8",
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
    source: "manual",
  },
  {
    id: "6",
    title: "Freelance Payment",
    amount: 350,
    type: "income",
    category: "Salary",
    categoryIcon: "💼",
    categoryColor: "#00C897",
    date: new Date(Date.now() - 5 * 86400000).toISOString(),
    source: "ai",
  },
  {
    id: "7",
    title: "Gym Membership",
    amount: 40,
    type: "expense",
    category: "Health",
    categoryIcon: "💪",
    categoryColor: "#55EFC4",
    date: new Date(Date.now() - 6 * 86400000).toISOString(),
    source: "manual",
  },
  {
    id: "8",
    title: "Electricity Bill",
    amount: 110,
    type: "expense",
    category: "Utilities",
    categoryIcon: "⚡",
    categoryColor: "#74B9FF",
    date: new Date(Date.now() - 7 * 86400000).toISOString(),
    source: "manual",
  },
];

export const MOCK_CATEGORIES: Category[] = [
  { id: "1", name: "Food & Dining", type: "expense", icon: "🍕", color: "#FF6B6B", transactionCount: 12, monthlyTotal: 320 },
  { id: "2", name: "Transport", type: "expense", icon: "🚗", color: "#4ECDC4", transactionCount: 8, monthlyTotal: 145 },
  { id: "3", name: "Shopping", type: "expense", icon: "🛍️", color: "#FFE66D", transactionCount: 5, monthlyTotal: 280 },
  { id: "4", name: "Housing", type: "expense", icon: "🏠", color: "#A29BFE", transactionCount: 2, monthlyTotal: 1200 },
  { id: "5", name: "Entertainment", type: "expense", icon: "🎬", color: "#FD79A8", transactionCount: 4, monthlyTotal: 75 },
  { id: "6", name: "Health", type: "expense", icon: "💊", color: "#55EFC4", transactionCount: 3, monthlyTotal: 90 },
  { id: "7", name: "Utilities", type: "expense", icon: "⚡", color: "#74B9FF", transactionCount: 3, monthlyTotal: 180 },
  { id: "8", name: "Salary", type: "income", icon: "💼", color: "#00C897", transactionCount: 2, monthlyTotal: 5350 },
  { id: "9", name: "Freelance", type: "income", icon: "💻", color: "#6C63FF", transactionCount: 3, monthlyTotal: 1200 },
];

export const MOCK_BUDGETS: Budget[] = [
  { id: "1", categoryId: "1", categoryName: "Food & Dining", categoryIcon: "🍕", categoryColor: "#FF6B6B", limitAmount: 400, spentAmount: 320, percentage: 80 },
  { id: "2", categoryId: "2", categoryName: "Transport", categoryIcon: "🚗", categoryColor: "#4ECDC4", limitAmount: 200, spentAmount: 145, percentage: 72.5 },
  { id: "3", categoryId: "3", categoryName: "Shopping", categoryIcon: "🛍️", categoryColor: "#FFE66D", limitAmount: 300, spentAmount: 280, percentage: 93.3 },
  { id: "4", categoryId: "5", categoryName: "Entertainment", categoryIcon: "🎬", categoryColor: "#FD79A8", limitAmount: 100, spentAmount: 75, percentage: 75 },
];

export const MOCK_DASHBOARD: DashboardSummary = {
  totalBalance: 24562,
  totalIncome: 45000,
  totalExpense: 20438,
  monthlyIncome: 8240.5,
  monthlyExpense: 3120,
  summaryMonth: new Date().getMonth() + 1,
  summaryYear: new Date().getFullYear(),
  recentTransactions: MOCK_TRANSACTIONS.slice(0, 5),
  budgetAlerts: [
    { categoryName: "Shopping", percentage: 93.3 },
    { categoryName: "Food & Dining", percentage: 80 },
  ],
  spendingTrend: [
    { date: "Mon", amount: 45 },
    { date: "Tue", amount: 120 },
    { date: "Wed", amount: 30 },
    { date: "Thu", amount: 200 },
    { date: "Fri", amount: 85 },
    { date: "Sat", amount: 160 },
    { date: "Sun", amount: 70 },
  ],
};

export const MOCK_DAILY: DailyAnalytics[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split("T")[0],
  income: i % 7 === 0 ? Math.random() * 2000 + 500 : 0,
  expense: Math.random() * 200 + 20,
}));

export const MOCK_CATEGORY_BREAKDOWN: CategoryBreakdown[] = [
  { category: "Food & Dining", icon: "🍕", color: "#FF6B6B", amount: 320, percentage: 32 },
  { category: "Housing", icon: "🏠", color: "#A29BFE", amount: 1200, percentage: 28 },
  { category: "Shopping", icon: "🛍️", color: "#FFE66D", amount: 280, percentage: 18 },
  { category: "Transport", icon: "🚗", color: "#4ECDC4", amount: 145, percentage: 12 },
  { category: "Entertainment", icon: "🎬", color: "#FD79A8", amount: 75, percentage: 6 },
  { category: "Other", icon: "📦", color: "#B2BEC3", amount: 100, percentage: 4 },
];

export const MOCK_MONTHLY: MonthlyComparison[] = [
  { month: "Sep", income: 6200, expense: 4100 },
  { month: "Oct", income: 7100, expense: 3800 },
  { month: "Nov", income: 6800, expense: 5200 },
  { month: "Dec", income: 9200, expense: 6100 },
  { month: "Jan", income: 7500, expense: 4300 },
  { month: "Feb", income: 8240, expense: 3120 },
];
