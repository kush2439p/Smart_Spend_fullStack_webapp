import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { categoriesApi, Category, CreateCategoryRequest } from "@/services/api";
import { MOCK_CATEGORIES } from "@/services/mockData";

const ICON_LIST = ["🍕","🚗","🛍️","🏠","🎬","💊","⚡","💼","💻","✈️","📚","🎵","💰","🏋️","🌿","🎁","🔧","🐾"];
const COLOR_LIST = ["#FF6B6B","#4ECDC4","#FFE66D","#A29BFE","#FD79A8","#55EFC4","#74B9FF","#FDCB6E","#E17055","#00C897","#6C63FF","#B2BEC3"];

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [activeTab, setActiveTab] = useState<"expense" | "income">("expense");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState(ICON_LIST[0]);
  const [newColor, setNewColor] = useState(COLOR_LIST[0]);
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await categoriesApi.getAll();
      setCategories(res);
    } catch {
      setCategories(MOCK_CATEGORIES);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = categories.filter((c) => c.type === activeTab || c.type === "both");

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert("Validation", "Category name is required"); return; }
    setSaving(true);
    const payload: CreateCategoryRequest = { name: newName, type: newType, icon: newIcon, color: newColor };
    try {
      const created = await categoriesApi.create(payload);
      setCategories((prev) => [...prev, created]);
    } catch {
      const mock: Category = { id: Date.now().toString(), name: newName, type: newType, icon: newIcon, color: newColor, transactionCount: 0, monthlyTotal: 0 };
      setCategories((prev) => [...prev, mock]);
    }
    setShowForm(false);
    setNewName("");
    setSaving(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Categories</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowForm(true)}>
          <Icon name="plus" size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <Text style={styles.subtitle}>Manage your spending categories and icons.</Text>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={16} color={Colors.textSecondary} />
        <Text style={styles.searchPlaceholder}>Search categories...</Text>
      </View>

      {/* Tab */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, activeTab === "expense" && styles.tabBtnActive]}
          onPress={() => setActiveTab("expense")}
        >
          <Text style={[styles.tabBtnText, activeTab === "expense" && styles.tabBtnTextActive]}>Expense</Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, activeTab === "income" && styles.tabBtnActive]}
          onPress={() => setActiveTab("income")}
        >
          <Text style={[styles.tabBtnText, activeTab === "income" && styles.tabBtnTextActive]}>Income</Text>
        </Pressable>
      </View>

      {/* Grid */}
      <FlatList
        data={filtered}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="tag" size={40} color={Colors.border} />
            <Text style={styles.emptyText}>No categories yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.catCard}>
            <View style={[styles.catIcon, { backgroundColor: item.color + "20" }]}>
              <Text style={styles.catEmoji}>{item.icon}</Text>
            </View>
            <Text style={styles.catName}>{item.name}</Text>
            <Text style={styles.catCount}>{item.transactionCount} items</Text>
            <View style={styles.catFooter}>
              <Text style={styles.catTotal}>₹{item.monthlyTotal.toLocaleString()}</Text>
            </View>
          </View>
        )}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
        onPress={() => setShowForm(true)}
      >
        <Icon name="plus" size={24} color="#fff" />
      </Pressable>

      {/* New Category Modal */}
      <Modal visible={showForm} animationType="slide" transparent onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <Pressable onPress={() => setShowForm(false)}>
                <Icon name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Category Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g. Coffee Shops"
              placeholderTextColor={Colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.fieldLabel}>Transaction Type</Text>
            <View style={styles.typeRow}>
              {(["expense", "income"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, newType === t && { backgroundColor: t === "expense" ? Colors.expense : Colors.income }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeChipText, newType === t && { color: "#fff" }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Select Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_LIST.map((ic) => (
                <Pressable
                  key={ic}
                  style={[styles.iconOption, ic === newIcon && { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" }]}
                  onPress={() => setNewIcon(ic)}
                >
                  <Text style={{ fontSize: 22 }}>{ic}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Theme Color</Text>
            <View style={styles.colorGrid}>
              {COLOR_LIST.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.colorOption, { backgroundColor: c }, c === newColor && styles.colorOptionActive]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>

            <Pressable style={[styles.saveBtn, { opacity: saving ? 0.8 : 1 }]} onPress={handleCreate} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Create Category"}</Text>
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
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, paddingHorizontal: 20, marginBottom: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  searchPlaceholder: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 16 },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  grid: { paddingHorizontal: 20, paddingBottom: 100 },
  catCard: { flex: 1, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  catIcon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  catEmoji: { fontSize: 24 },
  catName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  catCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  catFooter: { marginTop: 4 },
  catTotal: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.text },
  fab: { position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center", shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "flex-end" },
  modalContent: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  fieldInput: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.text },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  typeChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.textSecondary },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.border },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorOption: { width: 32, height: 32, borderRadius: 16 },
  colorOptionActive: { borderWidth: 3, borderColor: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
