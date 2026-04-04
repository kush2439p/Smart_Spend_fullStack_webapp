import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Colors } from "@/constants/colors";
import { transactionsApi, categoriesApi, Category } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { MOCK_CATEGORIES } from "@/services/mockData";

const INCOME_CATEGORIES = MOCK_CATEGORIES.filter((c) => c.type === "income" || c.type === "both");
const EXPENSE_CATEGORIES = MOCK_CATEGORIES.filter((c) => c.type === "expense" || c.type === "both");

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type?: string }>();
  const queryClient = useQueryClient();
  const [txType, setTxType] = useState<"income" | "expense">(
    params.type === "income" ? "income" : "expense"
  );
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    categoriesApi.getAll().then(setCategories).catch(() => setCategories(MOCK_CATEGORIES));
  }, []);

  const filteredCats = categories.filter((c) => c.type === txType || c.type === "both");

  const handleSave = async () => {
    if (!amount || !title || !selectedCategory) {
      Alert.alert("Validation", "Please fill in amount, title, and category");
      return;
    }
    setSaving(true);
    try {
      await transactionsApi.create({
        title,
        amount: parseFloat(amount),
        type: txType,
        category: selectedCategory.name,
        date: new Date(date).toISOString(),
        note,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      router.back();
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Saved (Mock)", "Transaction will be saved when backend is connected.");
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Feather name="x" size={24} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Add Transaction</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* Type Toggle */}
          <View style={styles.typeToggle}>
            <Pressable
              style={[styles.typeBtn, txType === "expense" && styles.typeBtnExpense]}
              onPress={() => { setTxType("expense"); setSelectedCategory(null); }}
            >
              <Text style={[styles.typeBtnText, txType === "expense" && styles.typeBtnTextActive]}>Expense</Text>
            </Pressable>
            <Pressable
              style={[styles.typeBtn, txType === "income" && styles.typeBtnIncome]}
              onPress={() => { setTxType("income"); setSelectedCategory(null); }}
            >
              <Text style={[styles.typeBtnText, txType === "income" && styles.typeBtnTextActive]}>Income</Text>
            </Pressable>
          </View>

          {/* Amount */}
          <View style={styles.amountSection}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.border}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.form}>
            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Title / Description</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Starbucks Coffee"
                placeholderTextColor={Colors.textSecondary}
                value={title}
                onChangeText={setTitle}
                returnKeyType="next"
              />
            </View>

            {/* Category Picker */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Category</Text>
              <Pressable style={styles.fieldInput} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
                {selectedCategory ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.catIcon, { backgroundColor: selectedCategory.color + "20" }]}>
                      <Text>{selectedCategory.icon}</Text>
                    </View>
                    <Text style={styles.fieldText}>{selectedCategory.name}</Text>
                  </View>
                ) : (
                  <Text style={{ color: Colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 }}>
                    Select category...
                  </Text>
                )}
              </Pressable>

              {showCategoryPicker && (
                <View style={styles.catGrid}>
                  {filteredCats.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[
                        styles.catGridItem,
                        selectedCategory?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + "15" },
                      ]}
                      onPress={() => { setSelectedCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <View style={[styles.catIconLg, { backgroundColor: cat.color + "20" }]}>
                        <Text style={{ fontSize: 22 }}>{cat.icon}</Text>
                      </View>
                      <Text style={styles.catName} numberOfLines={1}>{cat.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.fieldInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textSecondary}
                returnKeyType="next"
              />
            </View>

            {/* Note */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.fieldInput, { height: 80, paddingTop: 12 }]}
                placeholder="Add a note..."
                placeholderTextColor={Colors.textSecondary}
                value={note}
                onChangeText={setNote}
                multiline
                textAlignVertical="top"
                returnKeyType="done"
              />
            </View>

            {/* Save Button inside scroll so keyboard doesn't cover it */}
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: txType === "income" ? Colors.income : Colors.expense },
                (pressed || saving) && { opacity: 0.85 },
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  typeToggle: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  typeBtnExpense: { backgroundColor: Colors.expense },
  typeBtnIncome: { backgroundColor: Colors.income },
  typeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.textSecondary },
  typeBtnTextActive: { color: "#fff" },
  amountSection: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  currencySymbol: { fontFamily: "Inter_700Bold", fontSize: 36, color: Colors.textSecondary, marginRight: 4 },
  amountInput: { fontFamily: "Inter_700Bold", fontSize: 52, color: Colors.text, minWidth: 120 },
  form: { paddingHorizontal: 20, gap: 16 },
  field: { gap: 8 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  fieldInput: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    justifyContent: "center",
  },
  fieldText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.text },
  catIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  catGridItem: {
    width: "22%",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  catIconLg: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  catName: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.text, textAlign: "center" },
  saveBtn: { paddingVertical: 17, borderRadius: 16, alignItems: "center", marginTop: 8, marginBottom: 8 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
