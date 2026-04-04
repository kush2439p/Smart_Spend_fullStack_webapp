import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { categoriesApi, Category } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
];

const CATEGORY_ICONS = ["🛒", "🍔", "🚗", "🏠", "💊", "🎮", "👕", "✈️", "📚", "💼"];
const CATEGORY_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"expense" | "income">("expense");
  const [selectedIcon, setSelectedIcon] = useState("🛒");
  const [selectedColor, setSelectedColor] = useState("#FF6B6B");

  const handleCurrencyChange = (currency: string) => {
    updateUser({ currency });
    setShowCurrencyModal(false);
    queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    Alert.alert("Success", "Currency updated successfully!");
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert("Error", "Please enter a category name");
      return;
    }

    try {
      await categoriesApi.create({
        name: categoryName.trim(),
        type: categoryType,
        icon: selectedIcon,
        color: selectedColor,
      });
      
      setCategoryName("");
      setShowCategoryModal(false);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      Alert.alert("Success", "Category created successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to create category. Please try again.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
            </View>
          </View>
        </View>

        {/* Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Currency</Text>
          <Pressable 
            style={styles.settingItem} 
            onPress={() => setShowCurrencyModal(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Currency</Text>
              <Text style={styles.settingValue}>
                {CURRENCIES.find(c => c.code === user?.currency)?.symbol} {user?.currency}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <Pressable 
              style={styles.addBtn}
              onPress={() => setShowCategoryModal(true)}
            >
              <Feather name="plus" size={16} color={Colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sectionDescription}>
            Create custom categories for better expense tracking
          </Text>
        </View>
      </ScrollView>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Currency</Text>
              <Pressable onPress={() => setShowCurrencyModal(false)}>
                <Feather name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            {CURRENCIES.map((currency) => (
              <Pressable
                key={currency.code}
                style={[
                  styles.currencyItem,
                  user?.currency === currency.code && styles.currencyItemSelected
                ]}
                onPress={() => handleCurrencyChange(currency.code)}
              >
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                  <View>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                  </View>
                </View>
                {user?.currency === currency.code && (
                  <Feather name="check" size={20} color={Colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Category</Text>
              <Pressable onPress={() => setShowCategoryModal(false)}>
                <Feather name="x" size={22} color={Colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Category Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter category name"
              value={categoryName}
              onChangeText={setCategoryName}
            />

            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeSelector}>
              <Pressable
                style={[
                  styles.typeOption,
                  categoryType === "expense" && styles.typeOptionSelected
                ]}
                onPress={() => setCategoryType("expense")}
              >
                <Text style={[
                  styles.typeText,
                  categoryType === "expense" && styles.typeTextSelected
                ]}>Expense</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeOption,
                  categoryType === "income" && styles.typeOptionSelected
                ]}
                onPress={() => setCategoryType("income")}
              >
                <Text style={[
                  styles.typeText,
                  categoryType === "income" && styles.typeTextSelected
                ]}>Income</Text>
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Icon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.iconSelector}>
                {CATEGORY_ICONS.map((icon) => (
                  <Pressable
                    key={icon}
                    style={[
                      styles.iconOption,
                      selectedIcon === icon && styles.iconOptionSelected
                    ]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.colorSelector}>
                {CATEGORY_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorOptionSelected
                    ]}
                    onPress={() => setSelectedColor(color)}
                  >
                    {selectedColor === color && (
                      <Feather name="check" size={16} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Pressable style={styles.createBtn} onPress={handleCreateCategory}>
              <Text style={styles.createBtnText}>Create Category</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: Colors.text },
  content: { flex: 1, paddingHorizontal: 20 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: Colors.text, marginBottom: 12 },
  sectionDescription: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  profileCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
  },
  profileInfo: {},
  profileName: { fontSize: 16, fontWeight: "600", color: Colors.text },
  profileEmail: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  settingItem: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {},
  settingLabel: { fontSize: 16, fontWeight: "500", color: Colors.text },
  settingValue: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", color: Colors.text },
  currencyItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  currencyItemSelected: { backgroundColor: Colors.primary + "10" },
  currencyInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  currencySymbol: { fontSize: 24, fontWeight: "600" },
  currencyName: { fontSize: 16, fontWeight: "500", color: Colors.text },
  currencyCode: { fontSize: 14, color: Colors.textSecondary },
  fieldLabel: { 
    fontSize: 16, 
    fontWeight: "500", 
    color: Colors.text, 
    marginTop: 16,
    marginBottom: 8 
  },
  textInput: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeSelector: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  typeOptionSelected: { backgroundColor: Colors.primary },
  typeText: { fontSize: 14, fontWeight: "500", color: Colors.textSecondary },
  typeTextSelected: { color: "#fff" },
  iconSelector: {
    flexDirection: "row",
    gap: 12,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + "20",
  },
  iconText: { fontSize: 20 },
  colorSelector: {
    flexDirection: "row",
    gap: 12,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorOptionSelected: {
    borderColor: Colors.text,
    borderWidth: 3,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  createBtnText: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#fff" 
  },
});
