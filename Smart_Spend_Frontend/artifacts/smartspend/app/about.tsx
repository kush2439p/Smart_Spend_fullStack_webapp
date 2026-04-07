import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";

const APP_VERSION = "1.0.0";
const BUILD = "20260324";

const TEAM = [
  { name: "AI-Powered Budgeting", icon: "cpu", desc: "Natural language transaction logging and smart insights" },
  { name: "Receipt Scanner", icon: "camera", desc: "OCR-powered receipt scanning with instant categorization" },
  { name: "Multi-Bank Sync", icon: "credit-card", desc: "Connect all your accounts in one place" },
  { name: "Real-time Analytics", icon: "bar-chart-2", desc: "Beautiful charts and spending breakdowns" },
];

const LINKS = [
  { icon: "globe", label: "Website", url: "https://smartspend.app" },
  { icon: "twitter", label: "Twitter / X", url: "https://twitter.com/smartspend" },
  { icon: "github", label: "GitHub", url: "https://github.com/smartspend" },
  { icon: "star", label: "Rate on App Store", url: "#" },
];

const TECH = ["React Native", "Expo", "Spring Boot", "PostgreSQL", "OpenAI GPT-4o", "TensorFlow Lite"];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>About SmartSpend</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* App Logo Hero */}
        <LinearGradient colors={["#7C74FF", "#5B54E8", "#3730C0"]} style={styles.logoCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.logoBubble}>
            <Text style={styles.logoEmoji}>💸</Text>
          </View>
          <Text style={styles.logoTitle}>SmartSpend</Text>
          <Text style={styles.logoTagline}>Your AI-Powered Finance Companion</Text>
          <View style={styles.versionRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v{APP_VERSION}</Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>Build {BUILD}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Mission */}
        <View style={styles.missionCard}>
          <Text style={styles.missionTitle}>Our Mission</Text>
          <Text style={styles.missionText}>
            SmartSpend is built to make personal finance effortless. We combine AI-powered insights, automatic transaction detection, and beautiful analytics to give you a complete picture of your financial health — all in one place.
          </Text>
        </View>

        {/* Features */}
        <Text style={styles.sectionTitle}>Key Features</Text>
        <View style={styles.section}>
          {TEAM.map((f, i) => (
            <View key={i} style={[styles.featureRow, i === TEAM.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.featureIcon}>
                <Icon name={f.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.featureBody}>
                <Text style={styles.featureTitle}>{f.name}</Text>
                <Text style={styles.featureSub}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tech Stack */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Built With</Text>
        <View style={styles.techGrid}>
          {TECH.map((t) => (
            <View key={t} style={styles.techChip}>
              <Text style={styles.techText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* Links */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Connect With Us</Text>
        <View style={styles.section}>
          {LINKS.map((l, i) => (
            <Pressable
              key={i}
              style={[styles.linkRow, i === LINKS.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => Linking.openURL(l.url).catch(() => {})}
            >
              <View style={styles.linkIcon}>
                <Icon name={l.icon as any} size={18} color={Colors.primary} />
              </View>
              <Text style={styles.linkLabel}>{l.label}</Text>
              <Icon name="external-link" size={14} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ by the SmartSpend Team</Text>
          <Text style={styles.footerCopy}>© 2026 SmartSpend. All rights reserved.</Text>
          <Text style={styles.footerVersion}>Version {APP_VERSION} ({BUILD})</Text>
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
  logoCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  logoBubble: { width: 80, height: 80, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  logoEmoji: { fontSize: 40 },
  logoTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: "#fff", marginBottom: 6 },
  logoTagline: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.75)", marginBottom: 16 },
  versionRow: { flexDirection: "row", gap: 8 },
  versionBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" },
  versionText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#fff" },
  missionCard: { backgroundColor: Colors.card, borderRadius: 18, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  missionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 8 },
  missionText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 12 },
  section: { backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  featureIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  featureBody: { flex: 1 },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  featureSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 3, lineHeight: 18 },
  techGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  techChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.primary + "12", borderWidth: 1, borderColor: Colors.primary + "25" },
  techText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  linkIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  linkLabel: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  footer: { alignItems: "center", paddingTop: 32, gap: 6 },
  footerText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  footerCopy: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  footerVersion: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.border },
});
