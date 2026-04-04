import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const SECURITY_ITEMS = [
  { icon: "smartphone", label: "Biometric Login", sub: "Use Face ID or fingerprint", toggle: true, defaultOn: true },
  { icon: "lock", label: "App Lock PIN", sub: "Require PIN on launch", toggle: true, defaultOn: false },
  { icon: "shield", label: "Two-Factor Auth", sub: "Extra login protection", toggle: true, defaultOn: false },
  { icon: "eye-off", label: "Hide Balances", sub: "Mask amounts on dashboard", toggle: true, defaultOn: false },
];

const DATA_ITEMS = [
  { icon: "bar-chart-2", label: "Usage Analytics", sub: "Help improve the app anonymously", toggle: true, defaultOn: true },
  { icon: "bell", label: "Push Notifications", sub: "Budget alerts and insights", toggle: true, defaultOn: true },
  { icon: "message-square", label: "Marketing Emails", sub: "Tips and product updates", toggle: false, defaultOn: false },
];

const POLICY_LINKS = [
  { icon: "file-text", label: "Privacy Policy", updated: "Updated Jan 2026" },
  { icon: "clipboard", label: "Terms of Service", updated: "Updated Jan 2026" },
  { icon: "info", label: "Cookie Policy", updated: "Updated Dec 2025" },
  { icon: "database", label: "Data Processing Agreement", updated: "Updated Jan 2026" },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    [...SECURITY_ITEMS, ...DATA_ITEMS].forEach((item) => {
      init[item.label] = item.defaultOn;
    });
    return init;
  });

  const setToggle = (label: string, val: boolean) =>
    setToggles((prev) => ({ ...prev, [label]: val }));

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Security Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreLeft}>
            <Text style={styles.scoreTitle}>Security Score</Text>
            <Text style={styles.scoreSub}>Enable more features to improve your score</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreValue}>72</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
        </View>

        {/* Security */}
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.section}>
          {SECURITY_ITEMS.map((item) => (
            <View key={item.label} style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingBody}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingSub}>{item.sub}</Text>
              </View>
              {item.toggle && (
                <Switch
                  value={toggles[item.label]}
                  onValueChange={(v) => setToggle(item.label, v)}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  thumbColor="#fff"
                />
              )}
            </View>
          ))}
          <Pressable style={styles.settingRow} onPress={() => Alert.alert("Change Password", "A password reset link will be sent to your email.")}>
            <View style={styles.settingIcon}>
              <Feather name="key" size={18} color={Colors.primary} />
            </View>
            <View style={styles.settingBody}>
              <Text style={styles.settingLabel}>Change Password</Text>
              <Text style={styles.settingSub}>Last changed 30 days ago</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.settingRow} onPress={() => Alert.alert("Active Sessions", "You have 1 active session on this device.")}>
            <View style={styles.settingIcon}>
              <Feather name="monitor" size={18} color={Colors.primary} />
            </View>
            <View style={styles.settingBody}>
              <Text style={styles.settingLabel}>Active Sessions</Text>
              <Text style={styles.settingSub}>1 device currently logged in</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Data & Privacy */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Data & Privacy</Text>
        <View style={styles.section}>
          {DATA_ITEMS.map((item) => (
            <View key={item.label} style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name={item.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingBody}>
                <Text style={styles.settingLabel}>{item.label}</Text>
                <Text style={styles.settingSub}>{item.sub}</Text>
              </View>
              <Switch
                value={toggles[item.label]}
                onValueChange={(v) => setToggle(item.label, v)}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor="#fff"
              />
            </View>
          ))}
          <Pressable
            style={styles.settingRow}
            onPress={() => Alert.alert("Download My Data", "We'll prepare your data export and email you a link within 24 hours.")}
          >
            <View style={styles.settingIcon}>
              <Feather name="download-cloud" size={18} color={Colors.primary} />
            </View>
            <View style={styles.settingBody}>
              <Text style={styles.settingLabel}>Download My Data</Text>
              <Text style={styles.settingSub}>Export everything we have on you</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Pressable>
          <Pressable
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
            onPress={() => Alert.alert("Delete Account", "This will permanently delete all your data. Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive" },
            ])}
          >
            <View style={[styles.settingIcon, { backgroundColor: Colors.expense + "15" }]}>
              <Feather name="trash-2" size={18} color={Colors.expense} />
            </View>
            <View style={styles.settingBody}>
              <Text style={[styles.settingLabel, { color: Colors.expense }]}>Delete Account</Text>
              <Text style={styles.settingSub}>Permanently delete your account & data</Text>
            </View>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Legal */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Legal Documents</Text>
        <View style={styles.section}>
          {POLICY_LINKS.map((p, i) => (
            <Pressable key={i} style={[styles.settingRow, i === POLICY_LINKS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.settingIcon}>
                <Feather name={p.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingBody}>
                <Text style={styles.settingLabel}>{p.label}</Text>
                <Text style={styles.settingSub}>{p.updated}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  scoreLeft: { flex: 1 },
  scoreTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  scoreSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4, lineHeight: 18 },
  scoreBadge: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  scoreValue: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#fff", lineHeight: 52 },
  scoreMax: { fontFamily: "Inter_400Regular", fontSize: 16, color: "rgba(255,255,255,0.6)", marginBottom: 8 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 12 },
  section: { backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  settingIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  settingBody: { flex: 1 },
  settingLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  settingSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
