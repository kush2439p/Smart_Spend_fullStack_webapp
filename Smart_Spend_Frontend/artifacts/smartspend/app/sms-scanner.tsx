import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Colors } from "@/constants/colors";
import { smsApi, transactionsApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

interface ParsedSms {
  amount: number;
  type: string;
  merchant: string;
  suggestedCategory: string;
  date: string;
  rawText: string;
}

const BANK_KEYWORDS = [
  "debited", "credited", "rs.", "rs ", "inr", "₹",
  "upi", "phonePe", "gpay", "paytm", "hdfc", "sbi",
  "icici", "axis", "kotak", "paid to", "received from",
  "a/c", "account", "txn", "transaction", "ref no",
  "deducted", "transferred", "neft", "imps", "rtgs",
];

function looksLikeBankSMS(text: string): boolean {
  if (!text || text.length < 20) return false;
  const lower = text.toLowerCase();
  const matchCount = BANK_KEYWORDS.filter(k => lower.includes(k)).length;
  return matchCount >= 2;
}

export default function SmsScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSms | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastClipboard, setLastClipboard] = useState("");
  const [clipboardDetected, setClipboardDetected] = useState(false);
  const [waitingForCopy, setWaitingForCopy] = useState(true);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for the "waiting" indicator
  useEffect(() => {
    if (!waitingForCopy) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [waitingForCopy, pulseAnim]);

  const doParseAndSave = useCallback(async (text: string) => {
    if (!text.trim() || parsing) return;
    setParsing(true);
    setParsed(null);
    try {
      const result = await smsApi.parse(text.trim(), new Date().toISOString());
      setParsed(result as unknown as ParsedSms);
    } catch {
      Alert.alert(
        "Parse Error",
        "Could not read this SMS. Make sure it's a bank or UPI transaction message.",
      );
    } finally {
      setParsing(false);
    }
  }, [parsing]);

  // Auto clipboard polling (only in auto mode)
  useEffect(() => {
    if (mode !== "auto") return;

    const poll = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (text && text !== lastClipboard && looksLikeBankSMS(text)) {
          setLastClipboard(text);
          setSmsText(text);
          setClipboardDetected(true);
          setWaitingForCopy(false);
          doParseAndSave(text);
        }
      } catch {
        // Clipboard access denied - fail silently
      }
    };

    // Check immediately on mount
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [mode, lastClipboard, doParseAndSave]);

  const handleManualParse = async () => {
    if (!smsText.trim()) {
      Alert.alert("Empty", "Please paste an SMS message first.");
      return;
    }
    doParseAndSave(smsText);
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      await transactionsApi.create({
        title: parsed.merchant && parsed.merchant !== "Unknown" ? parsed.merchant : "Transaction",
        amount: parsed.amount,
        type: parsed.type === "INCOME" ? "income" : "expense",
        category: parsed.suggestedCategory || "Other",
        date: parsed.date ? new Date(parsed.date).toISOString() : new Date().toISOString(),
        note: `Parsed from SMS`,
      });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      Alert.alert("Saved!", "Transaction added successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save the transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSmsText("");
    setParsed(null);
    setClipboardDetected(false);
    setWaitingForCopy(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>SMS Scanner</Text>
          {/* Mode toggle */}
          <Pressable
            style={styles.modeToggle}
            onPress={() => { setMode(m => m === "auto" ? "manual" : "auto"); reset(); }}
          >
            <Feather
              name={mode === "auto" ? "edit-2" : "zap"}
              size={18}
              color={Colors.primary}
            />
          </Pressable>
        </View>

        {/* ─── AUTO MODE ─────────────────────────── */}
        {mode === "auto" && (
          <>
            {waitingForCopy && !parsing && !parsed && (
              <View style={styles.autoCard}>
                <Animated.View style={[styles.pulseCircle, { opacity: pulseAnim }]}>
                  <Feather name="message-square" size={36} color={Colors.primary} />
                </Animated.View>
                <Text style={styles.autoTitle}>Automatic SMS Detection</Text>
                <Text style={styles.autoSub}>
                  Open your <Text style={styles.bold}>Messages app</Text>, copy any bank or UPI SMS, then come back here.{"\n\n"}
                  SmartSpend will detect it <Text style={styles.bold}>automatically</Text> — no pasting needed.
                </Text>

                <View style={styles.stepsCard}>
                  {[
                    { icon: "message-circle", text: "Open Messages / PhonePe / GPay" },
                    { icon: "copy", text: "Long press & copy the transaction SMS" },
                    { icon: "zap", text: "Return here — auto-detected instantly" },
                  ].map((step, i) => (
                    <View key={i} style={styles.step}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>{i + 1}</Text>
                      </View>
                      <Feather name={step.icon as any} size={16} color={Colors.primary} style={{ marginRight: 10 }} />
                      <Text style={styles.stepText}>{step.text}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.worksWithLabel}>Works with</Text>
                <View style={styles.bankRow}>
                  {["PhonePe", "GPay", "Paytm", "HDFC", "SBI", "ICICI", "Axis"].map(b => (
                    <View key={b} style={styles.bankChip}>
                      <Text style={styles.bankChipText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {parsing && (
              <View style={styles.detectCard}>
                <Feather name="check-circle" size={20} color={Colors.income} />
                <Text style={styles.detectText}>Bank SMS detected — analyzing...</Text>
                <ActivityIndicator color={Colors.primary} size="small" style={{ marginLeft: 8 }} />
              </View>
            )}

            {clipboardDetected && smsText && !parsing && (
              <View style={styles.detectedBanner}>
                <Feather name="check-circle" size={16} color={Colors.income} />
                <Text style={styles.detectedText}>SMS auto-detected from clipboard</Text>
              </View>
            )}
          </>
        )}

        {/* ─── MANUAL MODE ───────────────────────── */}
        {mode === "manual" && (
          <>
            <View style={styles.infoCard}>
              <Feather name="edit-2" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>
                Paste your bank or UPI SMS below and tap Extract.
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Paste SMS</Text>
              <TextInput
                style={styles.smsInput}
                multiline
                numberOfLines={6}
                placeholder={"e.g.\nDebited INR 250.00 from A/C XX1234 to Swiggy on 04-04-2026. Ref No. 123456789"}
                placeholderTextColor={Colors.textSecondary}
                value={smsText}
                onChangeText={(t) => { setSmsText(t); setParsed(null); }}
                textAlignVertical="top"
              />
              {smsText.length > 0 && (
                <Pressable style={styles.clearBtn} onPress={reset}>
                  <Feather name="x-circle" size={16} color={Colors.textSecondary} />
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              style={[styles.parseBtn, (!smsText.trim() || parsing) && styles.parseBtnDisabled]}
              onPress={handleManualParse}
              disabled={!smsText.trim() || parsing}
            >
              {parsing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="zap" size={18} color="#fff" />
                  <Text style={styles.parseBtnText}>Extract Details</Text>
                </>
              )}
            </Pressable>
          </>
        )}

        {/* ─── RESULT CARD (both modes) ──────────── */}
        {parsed && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderLeft}>
                <Feather name="check-circle" size={16} color={Colors.income} />
                <Text style={styles.reviewHeaderText}>Details Extracted</Text>
              </View>
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: parsed.type === "INCOME" ? Colors.income + "18" : Colors.expense + "18" },
                ]}
              >
                <Text
                  style={[
                    styles.typeBadgeText,
                    { color: parsed.type === "INCOME" ? Colors.income : Colors.expense },
                  ]}
                >
                  {parsed.type === "INCOME" ? "Income" : "Expense"}
                </Text>
              </View>
            </View>

            <ReviewRow label="Merchant / Payee" value={parsed.merchant || "Unknown"} icon="user" />
            <ReviewRow
              label="Amount"
              value={`₹${Number(parsed.amount).toFixed(2)}`}
              icon="credit-card"
              valueColor={parsed.type === "INCOME" ? Colors.income : Colors.expense}
            />
            <ReviewRow label="Category" value={parsed.suggestedCategory || "Other"} icon="grid" />
            <ReviewRow label="Date" value={parsed.date || new Date().toLocaleDateString()} icon="calendar" />

            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="plus-circle" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>Save Transaction</Text>
                </>
              )}
            </Pressable>

            <Pressable style={styles.tryAnotherBtn} onPress={reset}>
              <Text style={styles.tryAnotherText}>Scan Another SMS</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({
  label, value, icon, valueColor,
}: { label: string; value: string; icon: string; valueColor?: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowLeft}>
        <Feather name={icon as any} size={14} color={Colors.textSecondary} />
        <Text style={styles.reviewLabel}>{label}</Text>
      </View>
      <Text style={[styles.reviewValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
  },
  backBtn: {
    padding: 8, backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },
  modeToggle: {
    padding: 8, backgroundColor: Colors.card, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.primary + "40",
  },

  // Auto mode
  autoCard: {
    marginHorizontal: 20, padding: 24, backgroundColor: Colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", marginBottom: 20,
  },
  pulseCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  autoTitle: {
    fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text,
    textAlign: "center", marginBottom: 10,
  },
  autoSub: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 22, marginBottom: 24,
  },
  bold: { fontFamily: "Inter_700Bold", color: Colors.text },

  stepsCard: {
    width: "100%", backgroundColor: Colors.background,
    borderRadius: 16, padding: 16, marginBottom: 20, gap: 14,
  },
  step: { flexDirection: "row", alignItems: "center" },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary, alignItems: "center",
    justifyContent: "center", marginRight: 10,
  },
  stepNumText: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  stepText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, flex: 1 },

  worksWithLabel: {
    fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.textSecondary,
    marginBottom: 10,
  },
  bankRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  bankChip: {
    backgroundColor: Colors.primary + "12", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  bankChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },

  detectCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 20, padding: 16, backgroundColor: Colors.income + "10",
    borderRadius: 16, borderWidth: 1, borderColor: Colors.income + "30",
    marginBottom: 16, gap: 8,
  },
  detectText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },

  detectedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 20, padding: 12, backgroundColor: Colors.income + "10",
    borderRadius: 12, marginBottom: 12,
  },
  detectedText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.income },

  // Manual mode
  infoCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    marginHorizontal: 20, padding: 16, backgroundColor: Colors.primary + "12",
    borderRadius: 16, borderWidth: 1, borderColor: Colors.primary + "25", marginBottom: 16,
  },
  infoText: {
    flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, lineHeight: 20,
  },
  inputSection: { marginHorizontal: 20, marginBottom: 16 },
  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text, marginBottom: 8 },
  smsInput: {
    backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: Colors.border, padding: 16, fontFamily: "Inter_400Regular",
    fontSize: 14, color: Colors.text, minHeight: 140, lineHeight: 22,
  },
  clearBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", marginTop: 8, padding: 4,
  },
  clearText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },

  parseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 20, paddingVertical: 16, borderRadius: 16,
    backgroundColor: Colors.primary, marginBottom: 24,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  // Review
  reviewCard: {
    marginHorizontal: 20, backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, padding: 20, marginBottom: 20,
  },
  reviewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  reviewHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewHeaderText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.income },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  reviewRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "60",
  },
  reviewRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  reviewValue: {
    fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text,
    maxWidth: "55%" as any, textAlign: "right",
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 20, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.primary,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  tryAnotherBtn: { alignItems: "center", paddingVertical: 14 },
  tryAnotherText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
});
