import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
  Rect,
  G,
} from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "expo-router";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { analyticsApi, CategoryBreakdown, MonthlyComparison, DailyAnalytics } from "@/services/api";
import { getCurrencySymbol, convertFromINR, formatCurrency } from "@/utils/currency";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_PADDING = 16;
const SCREEN_H_PADDING = 20;
const CHART_W = SCREEN_W - SCREEN_H_PADDING * 2 - CARD_PADDING * 2;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CACHE_TTL_MS = 90_000; // 90 seconds — cache per month

interface CacheEntry {
  breakdown: CategoryBreakdown[];
  monthly: MonthlyComparison[];
  daily: DailyAnalytics[];
  ts: number;
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const currency = user?.currency || "INR";

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeTab, setActiveTab] = useState<"overview" | "monthly" | "daily">("overview");

  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [monthly, setMonthly] = useState<MonthlyComparison[]>([]);
  const [daily, setDaily] = useState<DailyAnalytics[]>([]);

  // first load = full skeleton; subsequent = subtle overlay only
  const [firstLoad, setFirstLoad] = useState(true);
  const [isOverlayLoading, setIsOverlayLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // per-month cache so switching months you already viewed is instant
  const cache = useRef<Record<string, CacheEntry>>({});

  // ── Core fetch ────────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (month: number, year: number, force = false) => {
      const key = `${year}-${month}`;
      const cached = cache.current[key];

      // Use cache if fresh and not forced
      if (cached && !force && Date.now() - cached.ts < CACHE_TTL_MS) {
        setBreakdown(cached.breakdown);
        setMonthly(cached.monthly);
        setDaily(cached.daily);
        setFirstLoad(false);
        return;
      }

      setIsOverlayLoading(true);
      try {
        const [bd, m, d] = await Promise.all([
          analyticsApi.getCategoryBreakdown(month + 1, year),
          analyticsApi.getMonthlyComparison(),
          analyticsApi.getDaily(month + 1, year),
        ]);
        setBreakdown(bd ?? []);
        setMonthly(m ?? []);
        setDaily(d ?? []);
        cache.current[key] = { breakdown: bd ?? [], monthly: m ?? [], daily: d ?? [], ts: Date.now() };
      } catch {
        setBreakdown([]);
        setMonthly([]);
        setDaily([]);
      } finally {
        setIsOverlayLoading(false);
        setFirstLoad(false);
      }
    },
    []
  );

  // ── Load on month/year change ─────────────────────────────────────────
  useEffect(() => {
    fetchData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchData]);

  // ── Re-fetch on focus (only if cache is stale) ────────────────────────
  useFocusEffect(
    useCallback(() => {
      fetchData(selectedMonth, selectedYear);
    }, [selectedMonth, selectedYear, fetchData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(selectedMonth, selectedYear, true);
    setRefreshing(false);
  };

  const prevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const totalExpense = breakdown.reduce((s, b) => s + b.amount, 0);
  const totalIncome = daily.reduce((s, d) => s + d.income, 0);

  // ── Full skeleton (first load only) ──────────────────────────────────
  if (firstLoad) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { marginBottom: 16 }]}>
          <View style={{ width: 160, height: 24, backgroundColor: Colors.border, borderRadius: 8, opacity: 0.7 }} />
          <View style={{ width: 140, height: 34, backgroundColor: Colors.card, borderRadius: 12, opacity: 0.7 }} />
        </View>
        {[80, 48, 240].map((h, i) => (
          <View key={i} style={{ height: h, backgroundColor: Colors.card, borderRadius: 20, marginBottom: 16, opacity: 0.5 }} />
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: tabBarHeight + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={styles.navBtn}>
              <Icon name="chevron-left" size={18} color={Colors.text} />
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.monthText}>{MONTHS[selectedMonth]} {selectedYear}</Text>
              {isOverlayLoading && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>
            <Pressable onPress={nextMonth} style={styles.navBtn}>
              <Icon name="chevron-right" size={18} color={Colors.text} />
            </Pressable>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.income }]}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={[styles.summaryValue, { color: Colors.income }]}>{formatCurrency(totalIncome, currency)}</Text>
            <View style={styles.changeRow}>
              <Icon name="trending-up" size={11} color={Colors.income} />
              <Text style={[styles.summaryChange, { color: Colors.income }]}> This month</Text>
            </View>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: Colors.expense }]}>
            <Text style={styles.summaryLabel}>Spent</Text>
            <Text style={[styles.summaryValue, { color: Colors.expense }]}>{formatCurrency(totalExpense, currency)}</Text>
            <View style={styles.changeRow}>
              <Icon name="trending-down" size={11} color={Colors.expense} />
              <Text style={[styles.summaryChange, { color: Colors.expense }]}> This month</Text>
            </View>
          </View>
        </View>

        {/* Net savings */}
        {(totalIncome > 0 || totalExpense > 0) && (
          <View style={styles.netCard}>
            <Text style={styles.netLabel}>Net Savings</Text>
            <Text style={[styles.netAmount, { color: totalIncome - totalExpense >= 0 ? Colors.income : Colors.expense }]}>
              {totalIncome - totalExpense >= 0 ? "+" : ""}{formatCurrency(Math.abs(totalIncome - totalExpense), currency)}
            </Text>
            <Text style={styles.netSub}>
              {totalIncome - totalExpense >= 0 ? "Great job saving this month!" : "Spending more than income this month"}
            </Text>
          </View>
        )}

        {/* Tab Toggle — instant, no loading needed */}
        <View style={styles.tabRow}>
          {(["overview", "monthly", "daily"] as const).map((t) => (
            <Pressable key={t} style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]} onPress={() => setActiveTab(t)}>
              <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
                {t === "overview" ? "Overview" : t === "monthly" ? "Monthly" : "Daily"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <>
            {isOverlayLoading ? (
              <ChartSkeleton />
            ) : breakdown.length === 0 ? (
              <View style={styles.emptyCard}>
                <Icon name="pie-chart" size={36} color={Colors.border} />
                <Text style={styles.emptyTitle}>No expenses recorded</Text>
                <Text style={styles.emptyText}>
                  No expense transactions found for {MONTHS[selectedMonth]} {selectedYear}.
                </Text>
                {totalIncome > 0 && (
                  <View style={styles.emptyIncomeHint}>
                    <Icon name="trending-up" size={14} color={Colors.income} />
                    <Text style={styles.emptyIncomeText}>
                      {formatCurrency(totalIncome, currency)} income recorded — check the Daily tab.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Spending Breakdown</Text>
                  <DonutChart data={breakdown} currency={currency} totalAmount={totalExpense} />
                  <View style={styles.donutLegend}>
                    {breakdown.map((b) => (
                      <View key={b.category} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: b.color }]} />
                        <Text style={styles.legendLabel}>{b.category}</Text>
                        <Text style={styles.legendPct}>{b.percentage}%</Text>
                      </View>
                    ))}
                  </View>
                </View>

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
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={styles.rankName}>{b.category}</Text>
                            <Text style={styles.rankAmount}>{formatCurrency(b.amount, currency)}</Text>
                          </View>
                          <View style={styles.rankBarBg}>
                            <View style={[styles.rankBarFill, { width: `${b.percentage}%` as any, backgroundColor: b.color }]} />
                          </View>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </>
        )}

        {/* MONTHLY TAB — no loading needed, data already fetched */}
        {activeTab === "monthly" && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Income vs Expense (6 Months)</Text>
            {isOverlayLoading ? (
              <ChartSkeleton height={180} />
            ) : (
              <>
                <SVGBarChart data={monthly} currency={currency} />
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.income }]} />
                    <Text style={styles.legendLabel}>Income</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.expense }]} />
                    <Text style={styles.legendLabel}>Expenses</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* DAILY TAB */}
        {activeTab === "daily" && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Daily Spending — {MONTHS[selectedMonth]}</Text>
            {isOverlayLoading ? (
              <ChartSkeleton height={180} />
            ) : (
              <SVGLineChart data={daily} currency={currency} />
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Skeleton shown inside chart cards while month data loads ──────────────
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <View style={{ height, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={Colors.primary} size="large" />
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary }}>Loading…</Text>
    </View>
  );
}

/* ─── Donut Chart ────────────────────────────────────────── */
function DonutChart({ data, currency, totalAmount }: { data: CategoryBreakdown[]; currency: string; totalAmount: number }) {
  const size = 190;
  const strokeW = 30;
  const center = size / 2;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <View style={{ alignItems: "center", marginVertical: 12 }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} fill="none" stroke={Colors.border} strokeWidth={strokeW} />
        {data.map((item, i) => {
          const dash = (item.percentage / 100) * circ;
          const offset = -(cumPct / 100) * circ;
          cumPct += item.percentage;
          return (
            <Circle
              key={i} cx={center} cy={center} r={r} fill="none"
              stroke={item.color} strokeWidth={strokeW - 3}
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${center} ${center})`}
              strokeLinecap="butt"
            />
          );
        })}
      </Svg>
      <View style={{ position: "absolute", width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text }}>{formatCurrency(totalAmount, currency)}</Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary }}>Total Spent</Text>
      </View>
    </View>
  );
}

/* ─── SVG Line Chart (Daily) ─────────────────────────────── */
function SVGLineChart({ data, currency }: { data: DailyAnalytics[]; currency: string }) {
  const W = CHART_W;
  const H = 170;
  const pL = 46, pR = 8, pT = 14, pB = 28;
  const drawW = W - pL - pR;
  const drawH = H - pT - pB;
  const sym = getCurrencySymbol(currency);

  const expenses = data.map((d) => d.expense);
  const maxVal = Math.max(...expenses, 1);
  const hasData = expenses.some((v) => v > 0);

  if (!hasData) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", height: H, gap: 10 }}>
        <Icon name="trending-up" size={32} color={Colors.border} />
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary }}>No spending recorded</Text>
      </View>
    );
  }

  const getX = (i: number) => pL + (i / Math.max(data.length - 1, 1)) * drawW;
  const getY = (v: number) => pT + drawH - (v / maxVal) * drawH;
  const pts = expenses.map((v, i) => ({ x: getX(i), y: getY(v) }));

  let pathStr = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], cur = pts[i];
    const cpX = (prev.x + cur.x) / 2;
    pathStr += ` C ${cpX} ${prev.y} ${cpX} ${cur.y} ${cur.x} ${cur.y}`;
  }
  const areaStr = `${pathStr} L ${pts[pts.length - 1].x} ${pT + drawH} L ${pts[0].x} ${pT + drawH} Z`;

  const fmt = (v: number) => { const c = convertFromINR(v, currency); return c >= 1000 ? `${sym}${(c / 1000).toFixed(1)}k` : `${sym}${Math.round(c)}`; };
  const peakSet = new Set([...expenses.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.i));

  return (
    <View style={{ marginTop: 8 }}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.primary} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity={0.01} />
          </SvgGradient>
        </Defs>
        {[0, 0.5, 1].map((pct, i) => (
          <Line key={i} x1={pL} y1={pT + pct * drawH} x2={pL + drawW} y2={pT + pct * drawH} stroke={Colors.border} strokeWidth={1} strokeDasharray="3 4" />
        ))}
        <Path d={areaStr} fill="url(#areaGrad)" />
        <Path d={pathStr} fill="none" stroke={Colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {expenses.map((v, i) => peakSet.has(i) ? <Circle key={i} cx={getX(i)} cy={getY(v)} r={5} fill={Colors.primary} stroke="#fff" strokeWidth={2} /> : null)}
        <SvgText x={pL - 4} y={pT + 4} textAnchor="end" fontSize={9} fill={Colors.textSecondary}>{fmt(maxVal)}</SvgText>
        <SvgText x={pL - 4} y={pT + drawH / 2 + 4} textAnchor="end" fontSize={9} fill={Colors.textSecondary}>{fmt(maxVal / 2)}</SvgText>
        <SvgText x={pL - 4} y={pT + drawH + 4} textAnchor="end" fontSize={9} fill={Colors.textSecondary}>{sym}0</SvgText>
        <SvgText x={pL} y={H - 4} textAnchor="middle" fontSize={9} fill={Colors.textSecondary}>1</SvgText>
        <SvgText x={pL + drawW * 0.33} y={H - 4} textAnchor="middle" fontSize={9} fill={Colors.textSecondary}>10</SvgText>
        <SvgText x={pL + drawW * 0.66} y={H - 4} textAnchor="middle" fontSize={9} fill={Colors.textSecondary}>20</SvgText>
        <SvgText x={pL + drawW} y={H - 4} textAnchor="middle" fontSize={9} fill={Colors.textSecondary}>{data.length}</SvgText>
      </Svg>
    </View>
  );
}

/* ─── SVG Bar Chart (Monthly) ────────────────────────────── */
function SVGBarChart({ data, currency }: { data: MonthlyComparison[]; currency: string }) {
  const W = CHART_W;
  const H = 180;
  const pL = 8, pR = 8, pT = 16, pB = 28;
  const drawW = W - pL - pR;
  const drawH = H - pT - pB;
  const sym = getCurrencySymbol(currency);

  if (data.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", height: H }}>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary }}>No data available</Text>
      </View>
    );
  }

  const allVals = data.flatMap((d) => [d.income, d.expense]);
  const maxVal = Math.max(...allVals, 1);
  const groupW = drawW / data.length;
  const barW = Math.max((groupW - 14) / 2, 6);
  const fmt = (v: number) => { const c = convertFromINR(v, currency); return c >= 1000 ? `${sym}${(c / 1000).toFixed(0)}k` : `${sym}${Math.round(c)}`; };

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width={W} height={H}>
        <Defs>
          <SvgGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.income} stopOpacity={1} />
            <Stop offset="100%" stopColor={Colors.income} stopOpacity={0.7} />
          </SvgGradient>
          <SvgGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={Colors.expense} stopOpacity={1} />
            <Stop offset="100%" stopColor={Colors.expense} stopOpacity={0.7} />
          </SvgGradient>
        </Defs>
        {[0, 0.5, 1].map((pct, i) => (
          <Line key={i} x1={pL} y1={pT + pct * drawH} x2={pL + drawW} y2={pT + pct * drawH} stroke={Colors.border} strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {data.map((d, i) => {
          const gX = pL + i * groupW + 7;
          const incH = Math.max((d.income / maxVal) * drawH, 4);
          const expH = Math.max((d.expense / maxVal) * drawH, 4);
          return (
            <G key={i}>
              <Rect x={gX} y={pT + drawH - incH} width={barW} height={incH} fill="url(#incGrad)" rx={4} />
              <Rect x={gX + barW + 4} y={pT + drawH - expH} width={barW} height={expH} fill="url(#expGrad)" rx={4} />
              <SvgText x={gX + barW} y={H - 4} textAnchor="middle" fontSize={9} fill={Colors.textSecondary}>{d.month}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginTop: 8 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: Colors.text },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  navBtn: { padding: 4 },
  monthText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text, minWidth: 70, textAlign: "center" },
  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4 },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 4 },
  changeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  summaryChange: { fontFamily: "Inter_400Regular", fontSize: 11 },
  netCard: {
    backgroundColor: Colors.card, borderRadius: 14, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center", gap: 12,
  },
  netLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  netAmount: { fontFamily: "Inter_700Bold", fontSize: 17, flex: 1, textAlign: "center" },
  netSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, flex: 1, textAlign: "right" },
  tabRow: { flexDirection: "row", backgroundColor: Colors.card, borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  chartCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  chartTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 4 },
  donutLegend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.text },
  legendPct: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: Colors.textSecondary, marginLeft: 2 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 },
  rankNum: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.textSecondary, width: 16 },
  rankIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rankInfo: { flex: 1 },
  rankName: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  rankBarBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  rankBarFill: { height: "100%" as any, borderRadius: 3 },
  rankAmount: { fontFamily: "Inter_700Bold", fontSize: 12, color: Colors.text },
  emptyCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 32, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text, textAlign: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
  emptyIncomeHint: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.income + "15", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.income + "40" },
  emptyIncomeText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.income, flex: 1, lineHeight: 16 },
});
