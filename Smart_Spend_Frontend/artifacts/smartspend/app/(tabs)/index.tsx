import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Dimensions,
  Animated,
  Modal,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { dashboardApi, DashboardSummary, Transaction } from "@/services/api";
import { MOCK_DASHBOARD } from "@/services/mockData";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const { width } = Dimensions.get("window");

// Currency symbol helper
const getCurrencySymbol = (currency: string) => {
  switch (currency?.toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'JPY': return '¥';
    default: return '₹';
  }
};

function getRealNotifications(budgetAlerts: { categoryName: string; percentage: number }[]) {
  const notifs: { id: string; icon: string; color: string; title: string; body: string; time: string }[] = [];
  if (!budgetAlerts) return notifs;
  budgetAlerts.forEach((alert, i) => {
    if (alert.percentage >= 75) {
      const exceeded = alert.percentage >= 100;
      const critical = alert.percentage >= 90;
      notifs.push({
        id: `budget-${i}`,
        icon: exceeded ? "alert-octagon" : critical ? "alert-triangle" : "alert-circle",
        color: exceeded || critical ? Colors.expense : Colors.warning,
        title: exceeded ? "Budget Exceeded!" : critical ? "Budget Alert" : "Heads Up",
        body: `${alert.categoryName} is at ${Math.round(alert.percentage)}% of your monthly budget`,
        time: "Now",
      });
    }
  });
  return notifs;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: data = MOCK_DASHBOARD, refetch, isLoading } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => dashboardApi.getSummary().catch(() => MOCK_DASHBOARD),
    staleTime: 30000,
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  // Get currency symbol from user settings
  const currencySymbol = getCurrencySymbol(user?.currency || 'INR');

  // ── animations ──
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(cardAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      ]),
      Animated.timing(actionsAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(listAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Refresh dashboard data when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = async () => { 
    setRefreshing(true); 
    await refetch(); 
    setRefreshing(false); 
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const hasBudgetAlert = data.budgetAlerts?.length > 0;
  const notifications = getRealNotifications(data.budgetAlerts || []);
  const unreadCount = notifications.length;

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, {
        paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
        paddingBottom: tabBarHeight + 20,
      }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
        <View>
          <Text style={styles.greeting}>{greeting()}, {user?.name?.split(" ")[0] || "there"} 👋</Text>
          <Text style={styles.subGreeting}>Here's your financial overview</Text>
        </View>
        <Pressable style={styles.notifBtn} onPress={() => setShowNotifs(true)}>
          <Feather name="bell" size={21} color={Colors.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* ── Budget Alert Banner ── */}
      {hasBudgetAlert && (
        <Animated.View style={{ opacity: headerAnim }}>
          <Pressable style={styles.alertBanner} onPress={() => router.push("/budgets")}>
            <View style={styles.alertIconWrap}>
              <Ionicons name="warning" size={16} color={Colors.expense} />
            </View>
            <Text style={styles.alertText}>
              {data.budgetAlerts[0].categoryName} is at {Math.round(data.budgetAlerts[0].percentage)}% of budget
            </Text>
            <Feather name="chevron-right" size={15} color={Colors.expense} />
          </Pressable>
        </Animated.View>
      )}

      {/* ── Balance Card ── */}
      <Animated.View style={{ opacity: cardAnim, transform: [{ scale: cardScale }, { translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <LinearGradient colors={["#7C74FF", "#5B54E8", "#3730C0"]} style={styles.balanceCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.balCardCircle1} />
          <View style={styles.balCardCircle2} />
          <View style={styles.balCardCircle3} />
          <View style={styles.balCardHeader}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <View style={styles.balCardBadge}>
              <Text style={styles.balCardBadgeText}>All Time</Text>
            </View>
          </View>
          <Text style={styles.balanceAmount}>
            {currencySymbol}{(data.totalBalance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <View style={styles.balStat}>
              <View style={[styles.balStatIcon, { backgroundColor: Colors.income + "30" }]}>
                <Feather name="arrow-down-circle" size={16} color={Colors.income} />
              </View>
              <View>
                <Text style={styles.balStatLabel}>Income</Text>
                <Text style={[styles.balStatValue, { color: Colors.income }]}>
                  +{currencySymbol}{(data.totalIncome ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <View style={styles.balStatDivider} />
            <View style={styles.balStat}>
              <View style={[styles.balStatIcon, { backgroundColor: Colors.expense + "30" }]}>
                <Feather name="arrow-up-circle" size={16} color={Colors.expense} />
              </View>
              <View>
                <Text style={styles.balStatLabel}>Expenses</Text>
                <Text style={[styles.balStatValue, { color: Colors.expense }]}>
                  -{currencySymbol}{(data.totalExpense ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Quick Actions ── */}
      <Animated.View style={{ opacity: actionsAnim, transform: [{ translateY: actionsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <QuickActionBtn icon="minus-circle" label="Expense" color={Colors.expense} emoji="💸" onPress={() => router.push({ pathname: "/add-transaction", params: { type: "expense" } })} />
          <QuickActionBtn icon="plus-circle" label="Income" color={Colors.income} emoji="💰" onPress={() => router.push({ pathname: "/add-transaction", params: { type: "income" } })} />
          <QuickActionBtn icon="camera" label="Receipt" color={Colors.primary} emoji="📷" onPress={() => router.push("/receipt-scanner")} />
          <QuickActionBtn icon="message-square" label="Scan SMS" color="#00B894" emoji="💬" onPress={() => router.push("/sms-scanner")} />
        </View>
        <View style={styles.quickActions}>
          <QuickActionBtn icon="target" label="Budgets" color="#F59E0B" emoji="🎯" onPress={() => router.push("/budgets")} />
          <QuickActionBtn icon="tag" label="Categories" color="#8B5CF6" emoji="🏷️" onPress={() => router.push("/categories")} />
          <QuickActionBtn icon="bar-chart-2" label="Analytics" color="#06B6D4" emoji="📊" onPress={() => router.push("/(tabs)/analytics")} />
          <QuickActionBtn icon="list" label="Transactions" color="#EC4899" emoji="📋" onPress={() => router.push("/(tabs)/transactions")} />
        </View>
      </Animated.View>

      {/* ── Spending Trend ── */}
      {data.spendingTrend?.length > 0 && (
        <Animated.View style={[styles.trendCard, { opacity: actionsAnim }]}>
          <View style={styles.trendHeader}>
            <Text style={styles.sectionTitle}>7-Day Trend</Text>
            <View style={styles.trendBadge}>
              <Feather name="trending-up" size={12} color={Colors.income} />
              <Text style={styles.trendBadgeText}>This Week</Text>
            </View>
          </View>
          <MiniChart data={data.spendingTrend} />
        </Animated.View>
      )}

      {/* ── Budget Spotlight ── */}
      {hasBudgetAlert && (
        <Animated.View style={{ opacity: actionsAnim }}>
          <Pressable style={styles.budgetCard} onPress={() => router.push("/budgets")}>
            <View style={styles.budgetCardRow}>
              <Text style={styles.sectionTitle}>Budget Spotlight</Text>
              <View style={styles.seeAllChip}><Text style={styles.seeAllText}>See All</Text></View>
            </View>
            {data.budgetAlerts.slice(0, 2).map((b, i) => (
              <View key={i} style={[styles.budgetItem, i > 0 && { marginTop: 12 }]}>
                <View style={styles.budgetItemRow}>
                  <Text style={styles.budgetTitle}>{b.categoryName}</Text>
                  <Text style={[styles.budgetPct, { color: b.percentage >= 90 ? Colors.expense : b.percentage >= 75 ? Colors.warning : Colors.income }]}>
                    {Math.round(b.percentage)}%
                  </Text>
                </View>
                <View style={styles.budgetBarBg}>
                  <View style={[styles.budgetBarFill, {
                    width: `${Math.min(b.percentage, 100)}%` as any,
                    backgroundColor: b.percentage >= 90 ? Colors.expense : b.percentage >= 75 ? Colors.warning : Colors.income,
                  }]} />
                </View>
              </View>
            ))}
          </Pressable>
        </Animated.View>
      )}

      {/* ── Recent Transactions ── */}
      <Animated.View style={{ opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Pressable style={styles.seeAllChip} onPress={() => router.push("/(tabs)/transactions")}>
            <Text style={styles.seeAllText}>See All</Text>
          </Pressable>
        </View>
        <View style={styles.txList}>
          {data.recentTransactions.map((t, i) => (
            <TransactionRow key={t.id} transaction={t} index={i} currencySymbol={currencySymbol} />
          ))}
        </View>
      </Animated.View>
    </ScrollView>

    {/* ── Notifications Panel ── */}
    <NotificationModal visible={showNotifs} onClose={() => setShowNotifs(false)} insets={insets} notifications={notifications} />
    </>
  );
}

function QuickActionBtn({ icon, label, color, emoji, onPress }: { icon: string; label: string; color: string; emoji: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, friction: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start();
    onPress();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.qaBtn} onPress={press}>
        <LinearGradient colors={[color + "22", color + "10"]} style={[styles.qaIcon, { borderWidth: 1, borderColor: color + "30" }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </LinearGradient>
        <Text style={styles.qaLabel} numberOfLines={1}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function TransactionRow({ transaction: t, index, currencySymbol }: { transaction: Transaction; index: number; currencySymbol: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[styles.txRow, { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={[styles.txIcon, { backgroundColor: t.categoryColor + "20" }]}>
        <Text style={styles.txEmoji}>{t.categoryIcon}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>{t.title}</Text>
        <Text style={styles.txCat}>{t.category}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: t.type === "income" ? Colors.income : Colors.expense }]}>
          {t.type === "income" ? "+" : "-"}{currencySymbol}{Math.abs(t.amount).toFixed(2)}
        </Text>
        <Text style={styles.txDate}>{new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text>
      </View>
    </Animated.View>
  );
}

function MiniChart({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1); // Ensure max is at least 1
  const chartHeight = 64;
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(50, barAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 6, tension: 50, useNativeDriver: false }))).start();
  }, []);

  // If no data, show placeholder
  if (data.length === 0 || max === 0) {
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight + 20, gap: 4, marginTop: 8 }}>
        {[...Array(7)].map((_, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View style={{ width: "80%", height: 8, borderRadius: 6, backgroundColor: Colors.border }} />
            <Text style={{ fontSize: 9, color: Colors.textSecondary, fontFamily: "Inter_400Regular" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: chartHeight + 20, gap: 4, marginTop: 8 }}>
      {data.map((d, i) => {
        const targetH = Math.max((d.amount / max) * chartHeight, 6);
        const animH = barAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0, targetH] });
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <Animated.View style={{ width: "80%", height: animH, borderRadius: 6, backgroundColor: Colors.primary }}>
              <LinearGradient colors={[Colors.primaryLight, Colors.primary]} style={{ flex: 1, borderRadius: 6 }} />
            </Animated.View>
            <Text style={{ fontSize: 9, color: Colors.textSecondary, fontFamily: "Inter_400Regular" }}>
              {d.date.slice(0, 3)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function NotificationModal({ visible, onClose, insets, notifications }: { visible: boolean; onClose: () => void; insets: any; notifications: any[] }) {
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 70, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.notifOverlay, { opacity: fadeAnim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[styles.notifPanel, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.notifPanelHandle} />
          <View style={styles.notifPanelHeader}>
            <Text style={styles.notifPanelTitle}>Notifications</Text>
            {notifications.length > 0 && (
              <View style={styles.notifCountBadge}>
                <Text style={styles.notifCountText}>{notifications.length} alert{notifications.length > 1 ? "s" : ""}</Text>
              </View>
            )}
          </View>
          {notifications.length === 0 ? (
            <View style={styles.notifEmptyState}>
              <Feather name="bell-off" size={36} color={Colors.border} />
              <Text style={styles.notifEmptyTitle}>All Clear!</Text>
              <Text style={styles.notifEmptyText}>No alerts right now. You'll be notified when a budget is close to the limit or you receive a transaction.</Text>
            </View>
          ) : (
            notifications.map((n: any) => (
              <Pressable key={n.id} style={styles.notifItem}>
                <View style={[styles.notifItemIcon, { backgroundColor: n.color + "18" }]}>
                  <Feather name={n.icon as any} size={18} color={n.color} />
                </View>
                <View style={styles.notifItemBody}>
                  <Text style={styles.notifItemTitle}>{n.title}</Text>
                  <Text style={styles.notifItemText}>{n.body}</Text>
                </View>
                <Text style={styles.notifItemTime}>{n.time}</Text>
              </Pressable>
            ))
          )}
          <Pressable style={styles.clearAllBtn} onPress={onClose}>
            <Text style={styles.clearAllText}>{notifications.length > 0 ? "Dismiss" : "Close"}</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, marginTop: 8 },
  greeting: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  subGreeting: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  notifBtn: {
    position: "relative",
    padding: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  notifBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.expense,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  notifBadgeText: { fontFamily: "Inter_700Bold", fontSize: 9, color: "#fff" },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.expense + "12",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.expense + "25",
  },
  alertIconWrap: { width: 30, height: 30, borderRadius: 10, backgroundColor: Colors.expense + "20", alignItems: "center", justifyContent: "center" },
  alertText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.expense },

  balanceCard: {
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  balCardCircle1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.07)", top: -70, right: -50 },
  balCardCircle2: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left: 10 },
  balCardCircle3: { position: "absolute", width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.06)", bottom: 30, right: 40 },
  balCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  balCardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)" },
  balCardBadgeText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "rgba(255,255,255,0.8)" },
  balanceLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.7)" },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 40, color: "#fff", marginBottom: 20, letterSpacing: -1 },
  balanceDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginBottom: 18 },
  balanceRow: { flexDirection: "row", alignItems: "center" },
  balStat: { flex: 1, flexDirection: "row", gap: 10, alignItems: "center" },
  balStatDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: 16 },
  balStatIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  balStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.65)" },
  balStatValue: { fontFamily: "Inter_700Bold", fontSize: 16 },

  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text, marginBottom: 12 },

  quickActions: { flexDirection: "row", gap: 10, marginBottom: 22 },
  qaBtn: { flex: 1, alignItems: "center", gap: 8 },
  qaIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  qaLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.textSecondary, textAlign: "center" },

  trendCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  trendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  trendBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.income + "12" },
  trendBadgeText: { fontFamily: "Inter_500Medium", fontSize: 11, color: Colors.income },

  budgetCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  budgetCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  budgetItem: {},
  budgetItemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  budgetTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  budgetBarBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  budgetBarFill: { height: "100%", borderRadius: 4 },
  budgetPct: { fontFamily: "Inter_700Bold", fontSize: 14 },

  seeAllChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.primary + "12" },
  seeAllText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.primary },

  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  txList: { backgroundColor: Colors.card, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  txRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + "80", gap: 14 },
  txIcon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  txEmoji: { fontSize: 20 },
  txInfo: { flex: 1 },
  txTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  txCat: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  txDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 2 },

  // Notification Modal
  notifOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  notifPanel: { backgroundColor: Colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20 },
  notifPanelHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: "center", marginBottom: 20 },
  notifPanelHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  notifPanelTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, flex: 1 },
  notifCountBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: Colors.primary + "15" },
  notifCountText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: Colors.primary },
  notifItem: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  notifItemIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifItemBody: { flex: 1 },
  notifItemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  notifItemText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  notifItemTime: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  clearAllBtn: { paddingVertical: 18, alignItems: "center" },
  clearAllText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
  notifEmptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24, gap: 12 },
  notifEmptyTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  notifEmptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
