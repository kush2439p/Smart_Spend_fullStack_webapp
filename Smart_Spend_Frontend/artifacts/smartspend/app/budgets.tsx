import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { budgetsApi, categoriesApi, Budget, Category, CreateBudgetRequest } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

const OVERALL_BUDGET_KEY = "@smartspend_overall_budget";
const PAUSED_KEY = "@smartspend_budgets_paused";

function getBarColor(pct: number) {
  if (pct >= 100) return Colors.expense;
  if (pct >= 80) return "#FF9500";
  if (pct >= 60) return Colors.warning;
  return Colors.income;
}

interface OverallBudget {
  limit: number;
}

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Overall budget (persisted to AsyncStorage)
  const [overallBudget, setOverallBudget] = useState<OverallBudget | null>(null);
  const [paused, setPaused] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [limitAmount, setLimitAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Overall budget form
  const [showOverallForm, setShowOverallForm] = useState(false);
  const [overallLimit, setOverallLimit] = useState("");

  const now = new Date();

  // ── Load everything ───────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [b, c, savedOverall, savedPaused] = await Promise.all([
        budgetsApi.getAll(),
        categoriesApi.getAll(),
        AsyncStorage.getItem(OVERALL_BUDGET_KEY),
        AsyncStorage.getItem(PAUSED_KEY),
      ]);
      setBudgets(b);
      setCategories(c);
      setOverallBudget(savedOverall ? JSON.parse(savedOverall) : null);
      setPaused(savedPaused === "true");
    } catch {
      // API failed — still load persisted preferences
      try {
        const [savedOverall, savedPaused] = await Promise.all([
          AsyncStorage.getItem(OVERALL_BUDGET_KEY),
          AsyncStorage.getItem(PAUSED_KEY),
        ]);
        setOverallBudget(savedOverall ? JSON.parse(savedOverall) : null);
        setPaused(savedPaused === "true");
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived values ────────────────────────────────────────────────────
  const totalSpent = budgets.reduce((s, b) => s + b.spentAmount, 0);
  const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalRemaining = totalLimit - totalSpent;

  const overallSpent = totalSpent;
  const overallPct = overallBudget && overallBudget.limit > 0
    ? Math.min((overallSpent / overallBudget.limit) * 100, 100)
    : 0;

  const overBudgetCategories = paused ? [] : budgets.filter((b) => b.percentage >= 80);
  const overallAlert = !paused && overallBudget && overallPct >= 80;

  // ── Create category budget ────────────────────────────────────────────
  const handleCreate = async () => {
    if (!selectedCat || !limitAmount || isNaN(parseFloat(limitAmount))) {
      Alert.alert("Validation", "Please select a category and enter a valid limit");
      return;
    }
    setSaving(true);
    const payload: CreateBudgetRequest = {
      categoryId: selectedCat.id,
      limitAmount: parseFloat(limitAmount),
    };
    try {
      const created = await budgetsApi.create(payload);
      setBudgets((prev) => [...prev.filter(b => b.categoryId !== selectedCat.id), created]);
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    } catch (e: any) {
      Alert.alert("Error", "Could not save budget. Please check your connection and try again.");
    }
    setShowForm(false);
    setLimitAmount("");
    setSelectedCat(null);
    setSaving(false);
  };

  // ── Save overall budget ───────────────────────────────────────────────
  const handleSaveOverall = async () => {
    const val = parseFloat(overallLimit);
    if (!overallLimit || isNaN(val) || val <= 0) {
      Alert.alert("Validation", "Please enter a valid overall budget limit");
      return;
    }
    setSaving(true);
    const obj: OverallBudget = { limit: val };
    try {
      await AsyncStorage.setItem(OVERALL_BUDGET_KEY, JSON.stringify(obj));
      setOverallBudget(obj);
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    } catch {
      Alert.alert("Error", "Could not save overall budget. Please try again.");
    }
    setShowOverallForm(false);
    setOverallLimit("");
    setSaving(false);
  };

  // ── Delete overall budget ─────────────────────────────────────────────
  const handleDeleteOverall = () => {
    Alert.alert("Remove Overall Budget", "Remove the overall monthly budget limit?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem(OVERALL_BUDGET_KEY);
          setOverallBudget(null);
        },
      },
    ]);
  };

  // ── Delete category budget ────────────────────────────────────────────
  const handleDelete = (id: string) => {
    Alert.alert("Delete Budget", "Remove this budget goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try { await budgetsApi.delete(id); } catch {}
          setBudgets((prev) => prev.filter((b) => b.id !== id));
          queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
        },
      },
    ]);
  };

  // ── Toggle pause ──────────────────────────────────────────────────────
  const togglePause = async () => {
    const next = !paused;
    setPaused(next);
    await AsyncStorage.setItem(PAUSED_KEY, next ? "true" : "false");
  };

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Icon name="arrow-left" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Budget Planner</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary }}>
            Loading budgets...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Budget Planner</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Icon name="plus" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Month display */}
      <View style={styles.monthRow}>
        <Text style={styles.monthText}>
          {now.toLocaleString("default", { month: "long", year: "numeric" })}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Paused banner */}
        {paused && (
          <View style={styles.pausedBanner}>
            <Icon name="pause-circle" size={18} color={Colors.textSecondary} />
            <Text style={styles.pausedText}>Budget tracking is paused</Text>
            <Pressable onPress={togglePause}>
              <Text style={styles.resumeBtn}>Resume</Text>
            </Pressable>
          </View>
        )}

        {/* Overall budget card */}
        {overallBudget ? (
          <Pressable
            style={[styles.totalCard, overallAlert && styles.totalCardAlert]}
            onLongPress={handleDeleteOverall}
          >
            <View style={styles.totalCardTop}>
              <Text style={styles.totalLabel}>Overall Monthly Budget</Text>
              {overallAlert && <Text style={styles.overBudgetBadge}>⚠️ OVER {Math.round(overallPct)}%</Text>}
            </View>
            <Text style={styles.totalValue}>
              ₹{Math.max(overallBudget.limit - overallSpent, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              <Text style={styles.totalValueSub}> left</Text>
            </Text>
            <Text style={styles.totalSub}>
              Spent ₹{overallSpent.toLocaleString("en-IN")} of ₹{overallBudget.limit.toLocaleString("en-IN")} limit
            </Text>
            {/* Overall progress bar */}
            <View style={styles.overallProgress}>
              <View
                style={[
                  styles.overallProgressFill,
                  { width: `${overallPct}%` as any, backgroundColor: getBarColor(overallPct) },
                ]}
              />
            </View>
            <Text style={styles.totalHint}>Long press to remove</Text>
          </Pressable>
        ) : (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Category Budgets</Text>
            <Text style={styles.totalValue}>
              ₹{Math.max(totalRemaining, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              <Text style={styles.totalValueSub}> remaining</Text>
            </Text>
            <Text style={styles.totalSub}>
              Spent ₹{totalSpent.toLocaleString("en-IN")} of ₹{totalLimit.toLocaleString("en-IN")} total limit
            </Text>
          </View>
        )}

        {/* Alert box */}
        {!paused && (overBudgetCategories.length > 0 || overallAlert) && (
          <View style={styles.alertBox}>
            <Icon name="alert-triangle" size={18} color={Colors.expense} />
            <Text style={styles.alertText}>
              {overallAlert && overallPct >= 100
                ? `Overall budget exceeded! Spent ₹${overallSpent.toLocaleString("en-IN")} of ₹${overallBudget!.limit.toLocaleString("en-IN")}`
                : overallAlert
                ? `Overall budget ${Math.round(overallPct)}% used — ₹${(overallBudget!.limit - overallSpent).toLocaleString("en-IN")} remaining`
                : `${overBudgetCategories.length} budget${overBudgetCategories.length > 1 ? "s" : ""} over 80% — review your spending`}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => setShowForm(true)}>
            <Icon name="plus-circle" size={16} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Add Budget</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => {
            setOverallLimit(overallBudget ? String(overallBudget.limit) : "");
            setShowOverallForm(true);
          }}>
            <Icon name="sliders" size={16} color={Colors.primary} />
            <Text style={styles.actionBtnText}>
              {overallBudget ? "Edit Overall" : "Set Overall"}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, paused && styles.actionBtnActive]}
            onPress={togglePause}
          >
            <Icon name={paused ? "play-circle" : "pause-circle"} size={16} color={paused ? Colors.income : Colors.primary} />
            <Text style={[styles.actionBtnText, paused && { color: Colors.income }]}>
              {paused ? "Resume" : "Pause"}
            </Text>
          </Pressable>
        </View>

        {/* Category budgets */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
        </View>

        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="target" size={40} color={Colors.border} />
            <Text style={styles.emptyText}>No category budgets set yet</Text>
            <Text style={styles.emptySubText}>Tap "Add Budget" to track spending by category</Text>
            <Pressable style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>Create Budget</Text>
            </Pressable>
          </View>
        ) : (
          budgets.map((b) => {
            const isOver = b.percentage >= 100;
            const isWarn = b.percentage >= 80;
            return (
              <Pressable key={b.id} style={styles.budgetCard} onLongPress={() => handleDelete(b.id)}>
                <View style={styles.budgetTop}>
                  <View style={styles.budgetLeft}>
                    <View style={[styles.budgetIcon, { backgroundColor: b.categoryColor + "20" }]}>
                      <Text style={{ fontSize: 18 }}>{b.categoryIcon}</Text>
                    </View>
                    <View>
                      <Text style={styles.budgetName}>{b.categoryName}</Text>
                      <Text style={[styles.budgetPct, isOver && { color: Colors.expense }, isWarn && !isOver && { color: "#FF9500" }]}>
                        {isOver ? "🚨 " : isWarn && !paused ? "⚠️ " : ""}{Math.round(b.percentage)}% used
                      </Text>
                    </View>
                  </View>
                  <View style={styles.budgetRight}>
                    <Text style={styles.budgetLimit}>₹{b.limitAmount.toLocaleString("en-IN")}</Text>
                    <Text style={styles.budgetSpent}>Spent: ₹{b.spentAmount.toLocaleString("en-IN")}</Text>
                  </View>
                </View>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(b.percentage, 100)}%` as any,
                        backgroundColor: paused ? Colors.border : getBarColor(b.percentage),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.budgetHint}>Long press to delete</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowForm(true)}
      >
        <Icon name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Add Category Budget Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category Budget</Text>
              <Pressable onPress={() => { setShowForm(false); setSelectedCat(null); setLimitAmount(""); }}>
                <Icon name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Select Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {categories.filter((c) => c.type === "expense" || c.type === "both").map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[styles.catChip, selectedCat?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + "15" }]}
                    onPress={() => setSelectedCat(cat)}
                  >
                    <Text>{cat.icon}</Text>
                    <Text style={styles.catChipText}>{cat.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Monthly Limit (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 5000"
              placeholderTextColor={Colors.textSecondary}
              value={limitAmount}
              onChangeText={setLimitAmount}
              keyboardType="decimal-pad"
            />

            <Pressable
              style={[styles.saveBtn, { opacity: saving ? 0.8 : 1 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create Budget</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Overall Budget Modal */}
      <Modal visible={showOverallForm} animationType="slide" transparent onRequestClose={() => setShowOverallForm(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Overall Monthly Budget</Text>
              <Pressable onPress={() => { setShowOverallForm(false); setOverallLimit(""); }}>
                <Icon name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Total Monthly Limit (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 20000"
              placeholderTextColor={Colors.textSecondary}
              value={overallLimit}
              onChangeText={setOverallLimit}
              keyboardType="decimal-pad"
              autoFocus
            />

            <Text style={styles.overallHint}>
              This tracks your total spending across all categories for the month.
              {"\n"}Current total spend this month: ₹{overallSpent.toLocaleString("en-IN")}
            </Text>

            <Pressable
              style={[styles.saveBtn, { opacity: saving ? 0.8 : 1 }]}
              onPress={handleSaveOverall}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Overall Budget</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  monthRow: { alignItems: "center", marginBottom: 16 },
  monthText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  content: { paddingHorizontal: 20 },

  pausedBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.border + "60", borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  pausedText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  resumeBtn: { fontFamily: "Inter_700Bold", fontSize: 13, color: Colors.primary },

  totalCard: {
    backgroundColor: Colors.primary, borderRadius: 20, padding: 24, marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  totalCardAlert: {
    backgroundColor: Colors.expense,
    shadowColor: Colors.expense,
  },
  totalCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  totalLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)" },
  overBudgetBadge: { fontFamily: "Inter_700Bold", fontSize: 11, color: "#fff", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 34, color: "#fff", marginBottom: 4 },
  totalValueSub: { fontFamily: "Inter_400Regular", fontSize: 18, color: "rgba(255,255,255,0.8)" },
  totalSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 12 },
  overallProgress: { height: 6, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  overallProgressFill: { height: "100%", borderRadius: 3 },
  totalHint: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "right" },

  alertBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.expense + "15", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.expense + "30" },
  alertText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.expense },

  actionRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  actionBtnActive: { borderColor: Colors.income, backgroundColor: Colors.income + "10" },
  actionBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },

  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },

  budgetCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  budgetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  budgetIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  budgetName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  budgetPct: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  budgetRight: { alignItems: "flex-end" },
  budgetLimit: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  budgetSpent: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  budgetHint: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.border, textAlign: "right" },
  progressBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  emptySubText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: Colors.primary + "15" },
  emptyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },

  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  fieldInput: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.text },
  catChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  overallHint: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
