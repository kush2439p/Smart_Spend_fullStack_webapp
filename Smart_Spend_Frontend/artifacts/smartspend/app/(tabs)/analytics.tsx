import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { analyticsApi, CategoryBreakdown, MonthlyComparison, DailyAnalytics } from "@/services/api";
import { MOCK_CATEGORY_BREAKDOWN, MOCK_MONTHLY, MOCK_DAILY } from "@/services/mockData";
import { getCurrencySymbol, convertFromINR, formatCurrency } from "@/utils/currency";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const currency = user?.currency || "INR";
  const symbol = getCurrencySymbol(currency);

  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>(MOCK_CATEGORY_BREAKDOWN);
  const [monthly, setMonthly] = useState<MonthlyComparison[]>(MOCK_MONTHLY);
  const [daily, setDaily] = useState<DailyAnalytics[]>(MOCK_DAILY);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "monthly" | "daily">("overview");
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const load = useCallback(async () => {
    try {
      const [bd, m, d] = await Promise.all([
        analyticsApi.getCategoryBreakdown(selectedMonth + 1, selectedYear),
        analyticsApi.getMonthlyComparison(),
        analyticsApi.getDaily(selectedMonth + 1, selectedYear),
      ]);
      setBreakdown(bd);
      setMonthly(m);
      setDaily(d);
    } catch {
      setBreakdown(MOCK_CATEGORY_BREAKDOWN);
      setMonthly(MOCK_MONTHLY);
      setDaily(MOCK_DAILY);
    }
  }, [selectedMonth, selectedYear]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalExpense = breakdown.reduce((s, b) => s + b.amount, 0);
  const totalIncome = daily.reduce((s, d) => s + d.income, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: tabBarHeight + 20,
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics Hub</Text>
        <View style={styles.monthNav}>
          <Pressable onPress={() => {
            if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
            else setSelectedMonth(m => m - 1);
          }}>
            <Feather name="chevron-left" size={20} color={Colors.text} />
          </Pressable>
          <Text style={styles.monthText}>{MONTHS[selectedMonth]} {selectedYear}</Text>
          <Pressable onPress={() => {
            if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
            else setSelectedMonth(m => m + 1);
          }}>
            <Feather name="chevron-right" size={20} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabRow}>
        {(["overview", "monthly", "daily"] as const).map((t) => (
          <Pressable key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.income }]}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={[styles.summaryValue, { color: Colors.income }]}>
            {formatCurrency(totalIncome, currency)}
          </Text>
          <Text style={styles.summaryChange}>
            <Feather name="trending-up" size={12} color={Colors.income} /> +12.4%
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.expense }]}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
          <Text style={[styles.summaryValue, { color: Colors.expense }]}>
            {formatCurrency(totalExpense, currency)}
          </Text>
          <Text style={styles.summaryChange}>
            <Feather name="trending-down" size={12} color={Colors.expense} /> -8.2%
          </Text>
        </View>
      </View>

      {/* Main Chart Area */}
      {activeTab === "overview" && (
        <>
          {breakdown.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="pie-chart" size={36} color={Colors.border} />
              <Text style={styles.emptyText}>No expense data this month</Text>
            </View>
          ) : (
            <>
              {/* Stacked bar "pie" */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Expense Breakdown</Text>
                <View style={{ height: 20, flexDirection: "row", borderRadius: 10, overflow: "hidden", marginVertical: 16 }}>
                  {breakdown.map((d) => (
                    <View key={d.category} style={{ width: `${d.percentage}%` as any, backgroundColor: d.color }} />
                  ))}
                </View>
                <View style={styles.legend}>
                  {breakdown.map((b) => (
                    <View key={b.category} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                      <Text style={styles.legendLabel}>{b.category}</Text>
                      <Text style={styles.legendPct}>{b.percentage}%</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Category Ranking */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top Categories</Text>
                {[...breakdown]
                  .sort((a, b) => b.amount - a.amount)
                  .map((b, i) => (
                    <View key={b.category} style={styles.rankRow}>
                      <Text style={styles.rankNum}>{i + 1}</Text>
                      <View style={[styles.rankIcon, { backgroundColor: b.color + "20" }]}>
                        <Text>{b.icon}</Text>
                      </View>
                      <View style={styles.rankInfo}>
                        <Text style={styles.rankName}>{b.category}</Text>
                        <View style={styles.rankBarBg}>
                          <View style={[styles.rankBarFill, { width: `${b.percentage}%` as any, backgroundColor: b.color }]} />
                        </View>
                      </View>
                      <Text style={styles.rankAmount}>{formatCurrency(b.amount, currency)}</Text>
                    </View>
                  ))}
              </View>
            </>
          )}
        </>
      )}

      {activeTab === "monthly" && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Income vs Expense (6 Months)</Text>
          <BarChart data={monthly} currency={currency} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.income }]} />
              <Text style={styles.legendLabel}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.expense }]} />
              <Text style={styles.legendLabel}>Expense</Text>
            </View>
          </View>
        </View>
      )}

      {activeTab === "daily" && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Daily Spending This Month</Text>
          <DailyBarChart data={daily} currency={currency} />
        </View>
      )}
    </ScrollView>
  );
}

function BarChart({ data, currency }: { data: MonthlyComparison[]; currency: string }) {
  const allVals = data.flatMap((d) => [d.income, d.expense]);
  const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
  const chartH = 140;

  if (maxVal === 0 || data.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", height: chartH + 24, marginTop: 16 }}>
        <Feather name="bar-chart-2" size={32} color={Colors.border} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 8 }}>No data for this period</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH + 24, gap: 8, marginTop: 16 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end", height: chartH }}>
            <View style={{
              width: "45%",
              height: Math.max((d.income / maxVal) * chartH, 4),
              backgroundColor: Colors.income,
              borderRadius: 4,
            }} />
            <View style={{
              width: "45%",
              height: Math.max((d.expense / maxVal) * chartH, 4),
              backgroundColor: Colors.expense,
              borderRadius: 4,
            }} />
          </View>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textSecondary }}>{d.month}</Text>
        </View>
      ))}
    </View>
  );
}

function DailyBarChart({ data, currency }: { data: DailyAnalytics[]; currency: string }) {
  const expenses = data.map((d) => d.expense);
  const maxVal = expenses.length > 0 ? Math.max(...expenses) : 0;
  const chartH = 130;

  if (maxVal === 0 || data.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", height: chartH + 40, marginTop: 8 }}>
        <Feather name="trending-up" size={32} color={Colors.border} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 8 }}>No spending recorded this month</Text>
      </View>
    );
  }

  const symbol = getCurrencySymbol(currency);
  const topVal = convertFromINR(maxVal, currency);
  const midVal = convertFromINR(maxVal / 2, currency);
  const topLabel = topVal >= 1000 ? `${symbol}${(topVal / 1000).toFixed(1)}k` : `${symbol}${Math.round(topVal)}`;
  const midLabel = midVal >= 1000 ? `${symbol}${(midVal / 1000).toFixed(1)}k` : `${symbol}${Math.round(midVal)}`;

  return (
    <View style={{ marginTop: 12 }}>
      {/* Y-axis labels */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 36, justifyContent: "space-between", height: chartH, alignItems: "flex-end", paddingRight: 6 }}>
          <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSecondary }}>{topLabel}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSecondary }}>{midLabel}</Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textSecondary }}>{symbol}0</Text>
        </View>
        <View style={{ flex: 1 }}>
          {/* Reference lines */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: chartH }}>
            {[0, 0.5, 1].map((pct) => (
              <View key={pct} style={{
                position: "absolute",
                top: pct * chartH,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: Colors.border,
                opacity: 0.5,
              }} />
            ))}
          </View>
          {/* Bars */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH, gap: 2 }}>
            {expenses.map((v, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: Math.max((v / maxVal) * chartH, v > 0 ? 4 : 0),
                  backgroundColor: v > 0 ? Colors.primary : "transparent",
                  borderRadius: 3,
                  opacity: v > 0 ? (0.55 + 0.45 * (v / maxVal)) : 1,
                }}
              />
            ))}
          </View>
        </View>
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: "row", marginLeft: 36, marginTop: 6, justifyContent: "space-between" }}>
        <Text style={styles.chartAxisLabel}>1</Text>
        <Text style={styles.chartAxisLabel}>10</Text>
        <Text style={styles.chartAxisLabel}>20</Text>
        <Text style={styles.chartAxisLabel}>{expenses.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginTop: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  monthText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  tabRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4 },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 4 },
  summaryChange: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  chartCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  chartTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  chartAxisLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.text },
  legendPct: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.textSecondary, marginLeft: 2 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  rankNum: { fontFamily: "Inter_700Bold", fontSize: 14, color: Colors.textSecondary, width: 20 },
  rankIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankInfo: { flex: 1, gap: 4 },
  rankName: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  rankBarBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  rankBarFill: { height: "100%" as any, borderRadius: 3 },
  rankAmount: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.text },
  emptyCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 40, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },
});
