import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { Swipeable } from "react-native-gesture-handler";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { transactionsApi, Transaction } from "@/services/api";
import { getCurrencySymbol, convertFromINR } from "@/utils/currency";

const TYPE_FILTERS = ["All", "Income", "Expense"] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const DATE_FILTERS = ["This Week", "This Month", "Last 3 Months", "Last 6 Months"] as const;
type DateFilter = typeof DATE_FILTERS[number];

// ── Date range helper ──────────────────────────────────────────────────────
function getDateRange(df: DateFilter): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (df === "This Week") {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  } else if (df === "This Month") {
    start.setDate(1);
  } else if (df === "Last 3 Months") {
    start.setMonth(start.getMonth() - 3);
    start.setDate(1);
  } else if (df === "Last 6 Months") {
    start.setMonth(start.getMonth() - 6);
    start.setDate(1);
  }
  return { start, end };
}

// ── Group by date ──────────────────────────────────────────────────────────
function groupByDate(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups: Record<string, { sortKey: number; data: Transaction[] }> = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  txs.forEach((t) => {
    const d = new Date(t.date); d.setHours(0, 0, 0, 0);
    let key: string;
    let sortKey: number;
    if (d.getTime() === today.getTime()) { key = "Today"; sortKey = 3; }
    else if (d.getTime() === yesterday.getTime()) { key = "Yesterday"; sortKey = 2; }
    else { key = d.toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" }); sortKey = d.getTime(); }
    if (!groups[key]) groups[key] = { sortKey, data: [] };
    groups[key].data.push(t);
  });

  return Object.entries(groups)
    .sort(([, a], [, b]) => b.sortKey - a.sortKey)
    .map(([title, { data }]) => ({ title, data }));
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "#A29BFE" },
  ai: { label: "AI", color: Colors.primary },
  receipt: { label: "Receipt", color: "#FD79A8" },
  sms: { label: "SMS", color: "#4ECDC4" },
};

// ═══════════════════════════════════════════════════════════════════════════
export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const currency = user?.currency || "INR";

  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("This Month");
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch (always fetch all, filter client-side for instant tab switching) ─
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch enough data to cover longest date range (Last 6 Months)
      const res = await transactionsApi.getAll({ size: 500 });
      setAllTransactions(res.content ?? []);
    } catch {
      setAllTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Transaction", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await transactionsApi.delete(id);
            setAllTransactions((prev) => prev.filter((t) => t.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete. Please try again.");
          }
        },
      },
    ]);
  };

  // ── Client-side filtering (instant — no API call on tab switch) ────────
  const filtered = useMemo(() => {
    let txs = allTransactions;

    // Type filter
    if (typeFilter === "Income") txs = txs.filter((t) => t.type === "income");
    else if (typeFilter === "Expense") txs = txs.filter((t) => t.type === "expense");

    // Date filter
    const { start, end } = getDateRange(dateFilter);
    txs = txs.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    return txs;
  }, [allTransactions, typeFilter, dateFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // ── Summary totals for current filter ─────────────────────────────────
  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense };
  }, [filtered]);

  const symbol = getCurrencySymbol(currency);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Pressable style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Icon name="sliders" size={18} color={Colors.primary} />
          <Text style={styles.filterToggleText}>Filter</Text>
          {showFilters && <View style={styles.filterActiveDot} />}
        </Pressable>
      </View>

      {/* Type Filter Pills — instant switch, no loading */}
      <View style={styles.pillRow}>
        {TYPE_FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.pill, typeFilter === f && styles.pillActive]}
            onPress={() => setTypeFilter(f)}
          >
            <Text style={[styles.pillText, typeFilter === f && styles.pillTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {/* Date Filter */}
      {showFilters && (
        <View style={styles.extFilters}>
          <Text style={styles.extFilterLabel}>Date Range</Text>
          <View style={styles.pillRow}>
            {DATE_FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[styles.pill, dateFilter === f && styles.pillActive]}
                onPress={() => setDateFilter(f)}
              >
                <Text style={[styles.pillText, dateFilter === f && styles.pillTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Summary bar */}
      {!isLoading && filtered.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryAmount, { color: Colors.income }]}>
              +{symbol}{convertFromINR(totals.income, currency).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={[styles.summaryAmount, { color: Colors.expense }]}>
              -{symbol}{convertFromINR(totals.expense, currency).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>{filtered.length} txns</Text>
            <Text style={styles.summaryAmount}>{dateFilter}</Text>
          </View>
        </View>
      )}

      {/* List */}
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.title}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 8 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.txCard, { opacity: 0.4, marginTop: i === 0 ? 16 : 0 }]}>
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Colors.border }} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ width: "60%", height: 14, borderRadius: 6, backgroundColor: Colors.border }} />
                    <View style={{ width: "40%", height: 11, borderRadius: 6, backgroundColor: Colors.border }} />
                  </View>
                  <View style={{ width: 60, height: 14, borderRadius: 6, backgroundColor: Colors.border }} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="inbox" size={40} color={Colors.border} />
              <Text style={styles.emptyText}>No {typeFilter !== "All" ? typeFilter.toLowerCase() + " " : ""}transactions in {dateFilter.toLowerCase()}</Text>
              <Text style={styles.emptyHint}>Try a different date range or add a transaction</Text>
            </View>
          )
        }
        renderItem={({ item: group }) => (
          <View>
            <Text style={styles.groupHeader}>{group.title}</Text>
            {group.data.map((t) => (
              <SwipeableTransaction key={t.id} transaction={t} onDelete={handleDelete} currency={currency} />
            ))}
          </View>
        )}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: tabBarHeight + 16 }]}
        onPress={() => router.push("/add-transaction")}
      >
        <Icon name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

// ── Swipeable transaction card ─────────────────────────────────────────────
function SwipeableTransaction({ transaction: t, onDelete, currency }: { transaction: Transaction; onDelete: (id: string) => void; currency: string }) {
  const src = SOURCE_LABELS[t.source] ?? SOURCE_LABELS.manual;
  const symbol = getCurrencySymbol(currency);
  const displayAmount = convertFromINR(Math.abs(t.amount), currency);
  const amountStr = displayAmount >= 1000
    ? displayAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })
    : displayAmount.toFixed(2);

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.deleteAction} onPress={() => onDelete(t.id)}>
          <Icon name="trash-2" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      )}
    >
      <View style={styles.txCard}>
        <View style={[styles.txIcon, { backgroundColor: (t.categoryColor || "#6C63FF") + "20" }]}>
          <Text style={styles.txEmoji}>{t.categoryIcon || "💰"}</Text>
        </View>
        <View style={styles.txInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={styles.txTitle}>{t.title}</Text>
            <View style={[styles.sourceBadge, { backgroundColor: src.color + "20" }]}>
              <Text style={[styles.sourceBadgeText, { color: src.color }]}>{src.label}</Text>
            </View>
          </View>
          <Text style={styles.txCat}>
            {t.category} · {new Date(t.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: t.type === "income" ? Colors.income : Colors.expense }]}>
          {t.type === "income" ? "+" : "-"}{symbol}{amountStr}
        </Text>
      </View>
    </Swipeable>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  filterToggleText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  filterActiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 2 },

  pillRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 10, flexWrap: "wrap" },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  pillTextActive: { color: "#fff" },

  extFilters: { paddingHorizontal: 20, paddingBottom: 4 },
  extFilterLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },

  summaryBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 3 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  summaryAmount: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.text },

  groupHeader: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary, marginTop: 16, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  txCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  txIcon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  txEmoji: { fontSize: 22 },
  txInfo: { flex: 1 },
  txTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  txCat: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sourceBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10 },

  deleteAction: { backgroundColor: Colors.expense, alignItems: "center", justifyContent: "center", gap: 4, width: 88, marginBottom: 8, borderRadius: 16 },
  deleteActionText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },

  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 15, color: Colors.textSecondary },
  emptyHint: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.border },

  fab: {
    position: "absolute", right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});
