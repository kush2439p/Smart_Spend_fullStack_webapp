import React, { useState, useCallback, useEffect } from "react";
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

const FILTERS = ["All", "Income", "Expense"] as const;
const DATE_FILTERS = ["This Week", "This Month", "Last 3 Months", "Custom"] as const;

function groupByDate(txs: Transaction[]): { title: string; data: Transaction[] }[] {
  const groups: Record<string, Transaction[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  txs.forEach((t) => {
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    let key: string;
    if (d.getTime() === today.getTime()) key = "Today";
    else if (d.getTime() === yesterday.getTime()) key = "Yesterday";
    else key = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual", color: "#A29BFE" },
  ai: { label: "AI", color: Colors.primary },
  receipt: { label: "Receipt", color: "#FD79A8" },
  sms: { label: "SMS", color: "#4ECDC4" },
};

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const currency = user?.currency || "INR";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTERS[number]>("All");
  const [dateFilter, setDateFilter] = useState<typeof DATE_FILTERS[number]>("This Month");
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await transactionsApi.getAll({ size: 50, type: filter !== "All" ? filter.toLowerCase() : undefined });
      setTransactions(res.content);
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await transactionsApi.delete(id);
              setTransactions((prev) => prev.filter((t) => t.id !== id));
            } catch {
              Alert.alert("Error", "Failed to delete transaction. Please try again.");
            }
          },
        },
      ]
    );
  };

  const filtered = transactions.filter((t) => {
    if (filter === "Income") return t.type === "income";
    if (filter === "Expense") return t.type === "expense";
    return true;
  });

  const grouped = groupByDate(filtered);

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <Pressable style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
          <Icon name="sliders" size={18} color={Colors.primary} />
          <Text style={styles.filterToggleText}>Filter</Text>
        </Pressable>
      </View>

      {/* Type Filter Pills */}
      <View style={styles.pillRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>{f}</Text>
          </Pressable>
        ))}
      </View>

      {/* Extended Filters */}
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

      {/* List */}
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.title}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 8 }}>
              {[0, 1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.txCard, { opacity: 0.5, marginTop: i === 0 ? 16 : 0 }]}>
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
              <Text style={styles.emptyText}>No transactions found</Text>
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

function SwipeableTransaction({ transaction: t, onDelete, currency }: { transaction: Transaction; onDelete: (id: string) => void; currency: string }) {
  const src = SOURCE_LABELS[t.source] || SOURCE_LABELS.manual;
  const symbol = getCurrencySymbol(currency);
  const displayAmount = convertFromINR(Math.abs(t.amount), currency);
  const amountStr = displayAmount >= 1000
    ? displayAmount.toLocaleString("en-US", { maximumFractionDigits: 0 })
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
        <View style={[styles.txIcon, { backgroundColor: t.categoryColor + "20" }]}>
          <Text style={styles.txEmoji}>{t.categoryIcon}</Text>
        </View>
        <View style={styles.txInfo}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.txTitle}>{t.title}</Text>
            <View style={[styles.sourceBadge, { backgroundColor: src.color + "20" }]}>
              <Text style={[styles.sourceBadgeText, { color: src.color }]}>{src.label}</Text>
            </View>
          </View>
          <Text style={styles.txCat}>{t.category} · {new Date(t.date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</Text>
        </View>
        <Text style={[styles.txAmount, { color: t.type === "income" ? Colors.income : Colors.expense }]}>
          {t.type === "income" ? "+" : "-"}{symbol}{amountStr}
        </Text>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  filterToggle: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterToggleText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  pillRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12, flexWrap: "wrap" },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  pillTextActive: { color: "#fff" },
  extFilters: { paddingHorizontal: 20, marginBottom: 8 },
  extFilterLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  groupHeader: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary, marginTop: 16, marginBottom: 8 },
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
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
