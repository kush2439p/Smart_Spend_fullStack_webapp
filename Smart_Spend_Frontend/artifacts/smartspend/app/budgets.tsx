import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { budgetsApi, categoriesApi, Budget, Category, CreateBudgetRequest } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { MOCK_BUDGETS, MOCK_CATEGORIES } from "@/services/mockData";

function getBarColor(pct: number) {
  if (pct >= 90) return Colors.expense;
  if (pct >= 75) return Colors.warning;
  return Colors.income;
}

export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [budgets, setBudgets] = useState<Budget[]>(MOCK_BUDGETS);
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [showForm, setShowForm] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [limitAmount, setLimitAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [showOverallBudget, setShowOverallBudget] = useState(false);
  const [overallLimit, setOverallLimit] = useState("");
  const now = new Date();

  const load = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([budgetsApi.getAll(), categoriesApi.getAll()]);
      setBudgets(b);
      setCategories(c);
    } catch {
      setBudgets(MOCK_BUDGETS);
      setCategories(MOCK_CATEGORIES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const overBudget = budgets.filter((b) => b.percentage >= 80);

  const handleCreate = async () => {
    if (!selectedCat || !limitAmount) {
      Alert.alert("Validation", "Please select a category and enter a limit");
      return;
    }
    setSaving(true);
    const payload: CreateBudgetRequest = { categoryId: selectedCat.id, limitAmount: parseFloat(limitAmount) };
    try {
      const created = await budgetsApi.create(payload);
      setBudgets((prev) => [...prev, created]);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    } catch {
      const mock: Budget = {
        id: Date.now().toString(),
        categoryId: selectedCat.id,
        categoryName: selectedCat.name,
        categoryIcon: selectedCat.icon,
        categoryColor: selectedCat.color,
        limitAmount: parseFloat(limitAmount),
        spentAmount: 0,
        percentage: 0,
      };
      setBudgets((prev) => [...prev, mock]);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    }
    setShowForm(false);
    setLimitAmount("");
    setSelectedCat(null);
    setSaving(false);
  };

  const handleCreateOverallBudget = async () => {
    if (!overallLimit) {
      Alert.alert("Validation", "Please enter an overall budget limit");
      return;
    }
    setSaving(true);
    try {
      // Create overall budget (could be a special category or separate API call)
      const mock: Budget = {
        id: "overall",
        categoryId: "overall",
        categoryName: "Overall Budget",
        categoryIcon: "📊",
        categoryColor: Colors.primary,
        limitAmount: parseFloat(overallLimit),
        spentAmount: budgets.reduce((sum, b) => sum + b.spentAmount, 0),
        percentage: 0,
      };
      setBudgets((prev) => [mock, ...prev.filter(b => b.categoryId !== "overall")]);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    } catch {
      // Mock fallback
      const mock: Budget = {
        id: "overall",
        categoryId: "overall",
        categoryName: "Overall Budget",
        categoryIcon: "📊",
        categoryColor: Colors.primary,
        limitAmount: parseFloat(overallLimit),
        spentAmount: budgets.reduce((sum, b) => sum + b.spentAmount, 0),
        percentage: 0,
      };
      setBudgets((prev) => [mock, ...prev.filter(b => b.categoryId !== "overall")]);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    }
    setShowOverallBudget(false);
    setOverallLimit("");
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Budget", "Remove this budget goal?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try { await budgetsApi.delete(id); } catch {}
          setBudgets((prev) => prev.filter((b) => b.id !== id));
          queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Budget Planner</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Feather name="plus" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Month Selector */}
      <View style={styles.monthRow}>
        <Feather name="chevron-left" size={20} color={Colors.text} />
        <Text style={styles.monthText}>
          {now.toLocaleString("default", { month: "long", year: "numeric" })}
        </Text>
        <Feather name="chevron-right" size={20} color={Colors.text} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Total Budget Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Remaining</Text>
          <Text style={styles.totalValue}>
            ₹{(budgets.reduce((s, b) => s + (b.limitAmount - b.spentAmount), 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.totalSub}>
            Spent ₹{budgets.reduce((s, b) => s + b.spentAmount, 0).toLocaleString()} of ₹{budgets.reduce((s, b) => s + b.limitAmount, 0).toLocaleString()} limit
          </Text>
        </View>

        {/* Alerts */}
        {overBudget.length > 0 && (
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={18} color={Colors.expense} />
            <Text style={styles.alertText}>
              {overBudget.length} budget{overBudget.length > 1 ? "s" : ""} over 80% — review your spending
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable style={styles.actionBtn} onPress={() => setShowForm(true)}>
            <Feather name="plus-circle" size={16} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Create</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => setShowOverallBudget(true)}>
            <Feather name="sliders" size={16} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Adjust</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => {
            Alert.alert("Pause Budgets", "This would pause all budget tracking. Feature coming soon!");
          }}>
            <Feather name="pause-circle" size={16} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Pause</Text>
          </Pressable>
        </View>

        {/* Budget List */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Category Budgets</Text>
          <Pressable>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="target" size={40} color={Colors.border} />
            <Text style={styles.emptyText}>No budgets set yet</Text>
            <Pressable style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>Create Budget</Text>
            </Pressable>
          </View>
        ) : (
          budgets.map((b) => (
            <Pressable key={b.id} style={styles.budgetCard} onLongPress={() => handleDelete(b.id)}>
              <View style={styles.budgetTop}>
                <View style={styles.budgetLeft}>
                  <View style={[styles.budgetIcon, { backgroundColor: b.categoryColor + "20" }]}>
                    <Text style={{ fontSize: 18 }}>{b.categoryIcon}</Text>
                  </View>
                  <View>
                    <Text style={styles.budgetName}>{b.categoryName}</Text>
                    <Text style={styles.budgetCount}>
                      {b.percentage >= 80 ? "⚠️ " : ""}{Math.round(b.percentage)}% used
                    </Text>
                  </View>
                </View>
                <View style={styles.budgetRight}>
                  <Text style={styles.budgetLimit}>₹{b.limitAmount.toLocaleString()}</Text>
                  <Text style={styles.budgetSpent}>Spent: ₹{b.spentAmount.toLocaleString()}</Text>
                </View>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(b.percentage, 100)}%` as any,
                      backgroundColor: getBarColor(b.percentage),
                    },
                  ]}
                />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowForm(true)}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Add Budget Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Budget Goal</Text>
              <Pressable onPress={() => setShowForm(false)}>
                <Feather name="x" size={22} color={Colors.text} />
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
              placeholder="e.g. 500"
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
        </View>
      </Modal>

      {/* Overall Budget Modal */}
      <Modal visible={showOverallBudget} animationType="slide" transparent onRequestClose={() => setShowOverallBudget(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Overall Monthly Budget</Text>
              <Pressable onPress={() => setShowOverallBudget(false)}>
                <Feather name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Total Monthly Budget Limit (₹)</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. 10000"
              placeholderTextColor={Colors.textSecondary}
              value={overallLimit}
              onChangeText={setOverallLimit}
              keyboardType="decimal-pad"
            />

            <Pressable
              style={[styles.saveBtn, { opacity: saving ? 0.8 : 1 }]}
              onPress={handleCreateOverallBudget}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Set Overall Budget</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 20 },
  monthText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: Colors.text },
  content: { paddingHorizontal: 20 },
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  totalLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 4 },
  totalValue: { fontFamily: "Inter_700Bold", fontSize: 36, color: "#fff", marginBottom: 4 },
  totalSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.65)" },
  alertBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.expense + "15", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.expense + "30" },
  alertText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.expense },
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.text },
  seeAll: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  budgetCard: { backgroundColor: Colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  budgetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  budgetIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  budgetName: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  budgetCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  budgetRight: { alignItems: "flex-end" },
  budgetLimit: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  budgetSpent: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  progressBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: Colors.primary + "15" },
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
});
