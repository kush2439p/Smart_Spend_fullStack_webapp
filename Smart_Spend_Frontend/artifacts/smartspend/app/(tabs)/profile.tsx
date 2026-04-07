import React, { useState } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { exportApi } from "@/services/api";
import { getCurrencySymbol } from "@/utils/currency";

const CURRENCIES = [
  { code: "INR", name: "Indian Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SGD", name: "Singapore Dollar" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout, updateUser } = useAuth();
  const [smsParsing, setSmsParsing] = useState(true);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const currentCurrency = user?.currency || "INR";

  const handleExport = async (format: "pdf" | "excel") => {
    try {
      await exportApi.export(format);
      Alert.alert("Export Started", `Your data is being exported as ${format.toUpperCase()}.`);
    } catch {
      Alert.alert("Export", "Export feature coming soon!");
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setShowLogoutModal(false);
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <>
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
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.profileName}>{user?.name || "User"}</Text>
        <Text style={styles.profileEmail}>{user?.email || "user@example.com"}</Text>
      </View>

      {/* Account Section */}
      <SectionHeader title="ACCOUNT" />
      <View style={styles.section}>
        <SettingRow
          icon="dollar-sign"
          label="Base Currency"
          value={`${getCurrencySymbol(currentCurrency)} ${currentCurrency}`}
          onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
        />
        {showCurrencyPicker && (
          <View style={styles.currencyPicker}>
            {CURRENCIES.map((c) => (
              <Pressable
                key={c.code}
                style={[styles.currencyOption, c.code === currentCurrency && styles.currencyOptionActive]}
                onPress={() => {
                  updateUser({ currency: c.code });
                  setShowCurrencyPicker(false);
                  Alert.alert("Currency Updated", `All amounts are now shown in ${c.name} (${getCurrencySymbol(c.code)})`);
                }}
              >
                <Text style={[styles.currencyText, c.code === currentCurrency && styles.currencyTextActive]}>
                  {getCurrencySymbol(c.code)} {c.code}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <SettingRow
          icon="download"
          label="Export Data"
          onPress={() => Alert.alert("Export", "Choose format", [
            { text: "PDF", onPress: () => handleExport("pdf") },
            { text: "Excel", onPress: () => handleExport("excel") },
            { text: "Cancel", style: "cancel" },
          ])}
        />
      </View>

      {/* Preferences */}
      <SectionHeader title="PREFERENCES" />
      <View style={styles.section}>
        <ToggleRow
          icon="message-square"
          label="SMS Auto-detect"
          subtitle="Parse transactions from clipboard"
          value={smsParsing}
          onChange={setSmsParsing}
        />
        <ToggleRow
          icon="bell"
          label="Budget Alerts"
          subtitle="Notify when over 80% of budget"
          value={budgetAlerts}
          onChange={setBudgetAlerts}
        />
        <SettingRow icon="shield" label="Privacy & Security" onPress={() => router.push("/privacy")} />
        <SettingRow icon="help-circle" label="Help & Support" onPress={() => router.push("/help")} />
        <SettingRow icon="info" label="About SmartSpend" value="v1.0.0" onPress={() => router.push("/about")} />
      </View>

      {/* Manage */}
      <SectionHeader title="MANAGE" />
      <View style={styles.section}>
        <SettingRow icon="tag" label="Categories" onPress={() => router.push("/categories")} />
        <SettingRow icon="target" label="Budget Goals" onPress={() => router.push("/budgets")} />
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutBtn} onPress={() => setShowLogoutModal(true)}>
        <Icon name="log-out" size={18} color={Colors.expense} />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>

    {/* Logout Confirmation Modal */}
    <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.logoutModal}>
          <View style={styles.logoutModalIcon}>
            <Icon name="log-out" size={28} color={Colors.expense} />
          </View>
          <Text style={styles.logoutModalTitle}>Log out?</Text>
          <Text style={styles.logoutModalSub}>You'll need to sign in again to access your account.</Text>
          <Pressable
            style={[styles.logoutModalBtn, { backgroundColor: Colors.expense }]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <Text style={styles.logoutModalBtnText}>{loggingOut ? "Logging out..." : "Yes, Log Out"}</Text>
          </Pressable>
          <Pressable
            style={[styles.logoutModalBtn, { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border }]}
            onPress={() => setShowLogoutModal(false)}
            disabled={loggingOut}
          >
            <Text style={[styles.logoutModalBtnText, { color: Colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function SettingRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Icon name={icon as any} size={18} color={Colors.primary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        <Icon name="chevron-right" size={18} color={Colors.textSecondary} />
      </View>
    </Pressable>
  );
}

function ToggleRow({ icon, label, subtitle, value, onChange }: { icon: string; label: string; subtitle: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Icon name={icon as any} size={18} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  profileHeader: { alignItems: "center", paddingTop: 24, paddingBottom: 28 },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff" },
  profileName: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  profileEmail: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  sectionHeader: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
  },
  section: { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  settingLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  settingSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  settingRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  settingValue: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  currencyPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  currencyOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  currencyOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  currencyText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text },
  currencyTextActive: { color: "#fff" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.expense + "40",
    backgroundColor: Colors.expense + "08",
  },
  logoutText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.expense },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  logoutModal: {
    width: "100%",
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  logoutModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.expense + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoutModalTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  logoutModalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  logoutModalBtn: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  logoutModalBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
