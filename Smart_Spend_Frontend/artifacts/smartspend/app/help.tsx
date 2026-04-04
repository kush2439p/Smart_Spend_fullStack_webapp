import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  {
    q: "How do I connect my bank account?",
    a: "Go to Profile → Connected Sources → Bank Accounts. You can link your bank using your credentials. SmartSpend uses read-only access and never stores your banking password.",
  },
  {
    q: "How does the AI chat work?",
    a: 'Type a natural language message like "spent $50 on groceries today" and the AI will automatically create a transaction for you. You can also ask questions like "how much did I spend this week?"',
  },
  {
    q: "Can I scan any receipt?",
    a: "Yes! Tap the Scan Receipt button on the dashboard or the camera icon. Point your camera at any receipt and our AI will extract the merchant, amount, and date automatically.",
  },
  {
    q: "How do I set a budget?",
    a: "Go to Profile → Budget Goals (or the Budgets tab). Tap the + button, select a category, and set your monthly spending limit. You'll get alerts when you reach 80% of any budget.",
  },
  {
    q: "Is my financial data secure?",
    a: "All data is encrypted in transit using TLS and at rest using AES-256. Your JWT token is stored securely in device storage. We never sell your data to third parties.",
  },
  {
    q: "How do I export my transactions?",
    a: "Go to Profile → Export Data. You can download all your transactions as a PDF report or Excel spreadsheet, filterable by date range.",
  },
  {
    q: "What is SMS Parsing?",
    a: "When enabled, SmartSpend reads bank SMS alerts (e.g. 'Your account debited Rs. 500') and automatically creates transactions. Only messages from recognised bank senders are processed.",
  },
];

const SUPPORT_LINKS = [
  { icon: "mail", label: "Email Support", sub: "support@smartspend.app", action: () => Linking.openURL("mailto:support@smartspend.app") },
  { icon: "message-circle", label: "Live Chat", sub: "Typical reply: under 2 hours", action: () => {} },
  { icon: "book-open", label: "Documentation", sub: "Full user guide & API docs", action: () => Linking.openURL("https://docs.smartspend.app") },
  { icon: "youtube", label: "Video Tutorials", sub: "Step-by-step walkthroughs", action: () => {} },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((prev) => (prev === i ? null : i));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Feather name="help-circle" size={32} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>How can we help?</Text>
          <Text style={styles.heroSub}>Search our docs or get in touch with the team</Text>
        </View>

        {/* Support Channels */}
        <Text style={styles.sectionTitle}>Contact Support</Text>
        <View style={styles.section}>
          {SUPPORT_LINKS.map((s, i) => (
            <Pressable key={i} style={styles.supportRow} onPress={s.action}>
              <View style={styles.supportIcon}>
                <Feather name={s.icon as any} size={18} color={Colors.primary} />
              </View>
              <View style={styles.supportBody}>
                <Text style={styles.supportLabel}>{s.label}</Text>
                <Text style={styles.supportSub}>{s.sub}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* FAQs */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Frequently Asked Questions</Text>
        <View style={styles.section}>
          {FAQS.map((faq, i) => (
            <Pressable key={i} style={styles.faqItem} onPress={() => toggleFaq(i)}>
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestion}>{faq.q}</Text>
                <Feather name={openFaq === i ? "chevron-up" : "chevron-down"} size={18} color={Colors.primary} />
              </View>
              {openFaq === i && (
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              )}
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
  hero: { alignItems: "center", paddingVertical: 28, gap: 8 },
  heroIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: Colors.text },
  heroSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text, marginBottom: 12 },
  section: { backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  supportRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  supportIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.primary + "12", alignItems: "center", justifyContent: "center" },
  supportBody: { flex: 1 },
  supportLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  supportSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  faqItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border + "80" },
  faqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  faqQuestion: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, lineHeight: 20 },
  faqAnswer: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, marginTop: 12, lineHeight: 20 },
});
