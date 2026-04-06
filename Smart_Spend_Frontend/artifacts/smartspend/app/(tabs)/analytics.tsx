import React, { useState, useCallback, useEffect } from "react";
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
import { analyticsApi, CategoryBreakdown, MonthlyComparison, DailyAnalytics } from "@/services/api";
import { MOCK_CATEGORY_BREAKDOWN, MOCK_MONTHLY, MOCK_DAILY } from "@/services/mockData";

const { width } = Dimensions.get("window");
const CHART_WIDTH = width - 48;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
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
            ₹{totalIncome.toLocaleString()}
          </Text>
          <Text style={styles.summaryChange}>
            <Feather name="trending-up" size={12} color={Colors.income} /> +12.4%
          </Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: Colors.expense }]}>
          <Text style={styles.summaryLabel}>Total Spent</Text>
          <Text style={[styles.summaryValue, { color: Colors.expense }]}>
            ₹{totalExpense.toLocaleString()}
          </Text>
          <Text style={styles.summaryChange}>
            <Feather name="trending-down" size={12} color={Colors.expense} /> -8.2%
          </Text>
        </View>
      </View>

      {/* Main Chart Area */}
      {activeTab === "overview" && (
        <>
          {/* Pie Chart (simplified bar-based) */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Expense Breakdown</Text>
            <PieChartSimple data={breakdown} />
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
            {breakdown
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
                  <Text style={styles.rankAmount}>₹{b.amount}</Text>
                </View>
              ))}
          </View>
        </>
      )}

      {activeTab === "monthly" && (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Income vs Expense (6 Months)</Text>
          <BarChart data={monthly} />
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
          <LineChart data={daily.map((d) => d.expense)} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={styles.chartAxisLabel}>1</Text>
            <Text style={styles.chartAxisLabel}>10</Text>
            <Text style={styles.chartAxisLabel}>20</Text>
            <Text style={styles.chartAxisLabel}>30</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function PieChartSimple({ data }: { data: CategoryBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <View style={{ height: 20, flexDirection: "row", borderRadius: 10, overflow: "hidden", marginVertical: 16 }}>
      {data.map((d) => (
        <View
          key={d.category}
          style={{ width: `${d.percentage}%` as any, backgroundColor: d.color }}
        />
      ))}
    </View>
  );
}

function BarChart({ data }: { data: MonthlyComparison[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]));
  const chartH = 140;
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

function LineChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const chartH = 120;
  const barW = (CHART_WIDTH - 32) / data.length;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartH, marginTop: 16, gap: 2 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max((v / max) * chartH, 3),
            backgroundColor: Colors.primary,
            borderRadius: 2,
            opacity: 0.6 + 0.4 * (v / max),
          }}
        />
      ))}
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
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 4 },
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
  rankBarFill: { height: "100%", borderRadius: 3 },
  rankAmount: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.text },
});
