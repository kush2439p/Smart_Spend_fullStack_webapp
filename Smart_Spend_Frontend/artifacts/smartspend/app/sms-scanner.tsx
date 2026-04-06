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
  PermissionsAndroid,
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

type PermissionState = "unknown" | "requesting" | "granted" | "denied" | "unavailable";

const BANK_KEYWORDS = [
  "debited", "credited", "rs.", "rs ", "inr", "₹",
  "upi", "phonepe", "gpay", "paytm", "hdfc", "sbi",
  "icici", "axis", "kotak", "paid to", "received from",
  "a/c", "account", "txn", "transaction", "ref no",
  "deducted", "transferred", "neft", "imps", "rtgs",
];

function looksLikeBankSMS(text: string): boolean {
  if (!text || text.length < 20) return false;
  const lower = text.toLowerCase();
  const matchCount = BANK_KEYWORDS.filter((k) => lower.includes(k)).length;
  return matchCount >= 2;
}

// Try to load the native SMS listener — gracefully fails in Expo Go
let SmsListener: any = null;
try {
  SmsListener = require("react-native-android-sms-listener").default;
} catch {
  SmsListener = null;
}

export default function SmsScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [permState, setPermState] = useState<PermissionState>("unknown");
  const [listening, setListening] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSms | null>(null);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"sms" | "clipboard" | null>(null);
  const [lastClipboard, setLastClipboard] = useState("");

  // Use a ref so callbacks don't go stale when parsing changes
  const parsingRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const smsSubscription = useRef<any>(null);

  // Pulse animation while waiting/listening
  useEffect(() => {
    if (!listening && permState !== "requesting") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [listening, permState, pulseAnim]);

  const doParseAndSave = useCallback(
    async (text: string, src: "sms" | "clipboard") => {
      if (!text.trim() || parsingRef.current) return;
      parsingRef.current = true;
      setSource(src);
      setParsing(true);
      setParsed(null);
      setSmsText(text);
      try {
        const result = await smsApi.parse(text.trim(), new Date().toISOString());
        setParsed(result as unknown as ParsedSms);
      } catch (err: any) {
        Alert.alert(
          "Parse Error",
          "Could not read this SMS. Make sure it is a bank or UPI transaction message."
        );
      } finally {
        parsingRef.current = false;
        setParsing(false);
      }
    },
    []
  );

  // ── REQUEST PERMISSIONS ─────────────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== "android") {
      setPermState("unavailable");
      return;
    }
    setPermState("requesting");
    try {
      const permPromise = PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      const results = await Promise.race([permPromise, timeoutPromise]);
      if (!results) {
        // Timed out — fall back gracefully
        setPermState("unavailable");
        return;
      }
      const granted =
        results["android.permission.RECEIVE_SMS"] === PermissionsAndroid.RESULTS.GRANTED &&
        results["android.permission.READ_SMS"] === PermissionsAndroid.RESULTS.GRANTED;
      setPermState(granted ? "granted" : "denied");
    } catch {
      setPermState("unavailable");
    }
  }, []);

  // ── AUTO-REQUEST ON MOUNT (Android only) ────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "android") {
      requestPermissions();
    } else {
      setPermState("unavailable");
    }
  }, []);

  // ── REAL-TIME SMS LISTENER (needs native build) ─────────────────────────────
  useEffect(() => {
    if (permState !== "granted") return;
    if (!SmsListener) return; // Expo Go — will use clipboard fallback

    setListening(true);
    smsSubscription.current = SmsListener.onSmsReceived((message: { body: string; originatingAddress: string }) => {
      const body = message.body || "";
      if (looksLikeBankSMS(body)) {
        doParseAndSave(body, "sms");
      }
    });

    return () => {
      if (smsSubscription.current) {
        smsSubscription.current.remove();
        smsSubscription.current = null;
      }
      setListening(false);
    };
  }, [permState, doParseAndSave]);

  // ── CLIPBOARD FALLBACK (Expo Go or permission denied) ──────────────────────
  useEffect(() => {
    // Only use clipboard if: native listener not available OR permission denied
    const useClipboard =
      permState === "unavailable" ||
      permState === "denied" ||
      (permState === "granted" && !SmsListener);

    if (!useClipboard) return;

    const poll = async () => {
      try {
        const text = await Clipboard.getStringAsync();
        if (text && text !== lastClipboard && looksLikeBankSMS(text)) {
          setLastClipboard(text);
          doParseAndSave(text, "clipboard");
        }
      } catch {
        // fail silently
      }
    };

    poll();
    const interval = setInterval(poll, 1200);
    return () => clearInterval(interval);
  }, [permState, lastClipboard, doParseAndSave]);

  // ── SAVE ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      await transactionsApi.create({
        title:
          parsed.merchant && parsed.merchant !== "Unknown"
            ? parsed.merchant
            : "Transaction",
        amount: parsed.amount,
        type: parsed.type === "INCOME" ? "income" : "expense",
        category: parsed.suggestedCategory || "Other",
        date: parsed.date
          ? new Date(parsed.date).toISOString()
          : new Date().toISOString(),
        note: `Auto-detected from ${source === "sms" ? "SMS" : "clipboard"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      Alert.alert("Saved!", "Transaction added to your expenses.", [
        { text: "Done", onPress: () => router.back() },
        { text: "Scan Another", onPress: reset },
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
    setSource(null);
  };

  // ── MANUAL PARSE ──────────────────────────────────────────────────────────
  const handleManualParse = () => {
    if (!smsText.trim()) {
      Alert.alert("Empty", "Please paste an SMS message first.");
      return;
    }
    doParseAndSave(smsText, "clipboard");
  };

  // ── RENDER HELPERS ─────────────────────────────────────────────────────────
  const renderPermissionCard = () => (
    <View style={styles.centreCard}>
      <View style={styles.iconCircle}>
        <Feather name="message-square" size={36} color={Colors.primary} />
      </View>
      <Text style={styles.cardTitle}>Allow SMS Access</Text>
      <Text style={styles.cardSub}>
        SmartSpend needs permission to read your incoming messages so it can
        automatically detect payment transactions — no manual steps needed.
      </Text>
      <View style={styles.benefitList}>
        {[
          "Instant detection when payment SMS arrives",
          "Works with any bank, UPI app, or wallet",
          "Your messages are never stored or sent anywhere",
        ].map((b, i) => (
          <View key={i} style={styles.benefitRow}>
            <Feather name="check" size={15} color={Colors.income} />
            <Text style={styles.benefitText}>{b}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.primaryBtn} onPress={requestPermissions}>
        <Feather name="shield" size={18} color="#fff" />
        <Text style={styles.primaryBtnText}>Allow Message Access</Text>
      </Pressable>
    </View>
  );

  const renderDeniedCard = () => (
    <View style={styles.centreCard}>
      <View style={[styles.iconCircle, { backgroundColor: Colors.expense + "15" }]}>
        <Feather name="slash" size={32} color={Colors.expense} />
      </View>
      <Text style={styles.cardTitle}>Permission Denied</Text>
      <Text style={styles.cardSub}>
        SMS permission was not granted. You can still paste a payment SMS below
        and SmartSpend will parse it for you.
      </Text>
      <Pressable style={styles.primaryBtn} onPress={requestPermissions}>
        <Feather name="refresh-cw" size={16} color="#fff" />
        <Text style={styles.primaryBtnText}>Ask Again</Text>
      </Pressable>
      <ManualInput
        smsText={smsText}
        onChangeText={(t) => { setSmsText(t); setParsed(null); }}
        onClear={reset}
        onParse={handleManualParse}
        parsing={parsing}
      />
    </View>
  );

  const renderListeningCard = () => (
    <View style={styles.centreCard}>
      <Animated.View style={[styles.iconCircle, { opacity: pulseAnim, backgroundColor: Colors.income + "18" }]}>
        <Feather name="radio" size={36} color={Colors.income} />
      </Animated.View>
      <Text style={styles.cardTitle}>Listening for Payments</Text>
      <Text style={styles.cardSub}>
        SmartSpend is monitoring your incoming messages.{"\n"}Make a payment — it will be detected automatically.
      </Text>
      <View style={styles.liveChip}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live</Text>
      </View>
      <View style={styles.supportedRow}>
        {["PhonePe", "GPay", "Paytm", "HDFC", "SBI", "ICICI", "Axis", "NEFT"].map((b) => (
          <View key={b} style={styles.bankChip}>
            <Text style={styles.bankChipText}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderClipboardFallback = () => (
    <View style={styles.centreCard}>
      <Animated.View style={[styles.iconCircle, { opacity: pulseAnim }]}>
        <Feather name="message-square" size={36} color={Colors.primary} />
      </Animated.View>
      <Text style={styles.cardTitle}>Clipboard Detection Active</Text>
      <Text style={styles.cardSub}>
        Full SMS auto-reading needs a native app build. Until then, open your
        Messages app, <Text style={styles.bold}>copy</Text> any payment SMS and
        come back — it will be detected instantly.
      </Text>
      <View style={styles.infoBox}>
        <Feather name="info" size={14} color={Colors.primary} />
        <Text style={styles.infoBoxText}>
          For true background SMS reading, build the Android APK from this project.
        </Text>
      </View>
      <ManualInput
        smsText={smsText}
        onChangeText={(t) => { setSmsText(t); setParsed(null); }}
        onClear={reset}
        onParse={handleManualParse}
        parsing={parsing}
      />
    </View>
  );

  const renderBody = () => {
    if (parsed) return null; // result card shown below

    switch (permState) {
      case "unknown":
      case "requesting":
        return (
          <View style={styles.centreCard}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={[styles.cardSub, { marginTop: 16, textAlign: "center" }]}>
              Requesting SMS permission…
            </Text>
            <ManualInput
              smsText={smsText}
              onChangeText={(t) => { setSmsText(t); setParsed(null); }}
              onClear={reset}
              onParse={handleManualParse}
              parsing={parsing}
            />
          </View>
        );
      case "granted":
        return SmsListener ? renderListeningCard() : renderClipboardFallback();
      case "denied":
        return renderDeniedCard();
      case "unavailable":
        return renderClipboardFallback();
    }
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
          <View style={{ width: 40 }} />
        </View>

        {/* Detecting banner (while parsing) */}
        {parsing && (
          <View style={styles.detectCard}>
            <Feather name="zap" size={18} color={Colors.primary} />
            <Text style={styles.detectText}>
              {source === "sms" ? "Payment SMS received — analysing…" : "SMS detected — analysing…"}
            </Text>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        )}

        {/* Body (permission state / listening / fallback) */}
        {renderBody()}

        {/* Result Card */}
        {parsed && !parsing && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewHeaderLeft}>
                <Feather name="check-circle" size={16} color={Colors.income} />
                <Text style={styles.reviewHeaderText}>Details Extracted</Text>
              </View>
              <View style={[
                styles.typeBadge,
                { backgroundColor: parsed.type === "INCOME" ? Colors.income + "18" : Colors.expense + "18" },
              ]}>
                <Text style={[
                  styles.typeBadgeText,
                  { color: parsed.type === "INCOME" ? Colors.income : Colors.expense },
                ]}>
                  {parsed.type === "INCOME" ? "Income" : "Expense"}
                </Text>
              </View>
            </View>

            {source && (
              <View style={styles.sourceBadge}>
                <Feather
                  name={source === "sms" ? "radio" : "clipboard"}
                  size={12}
                  color={Colors.textSecondary}
                />
                <Text style={styles.sourceText}>
                  {source === "sms" ? "Detected from incoming SMS" : "Detected from clipboard"}
                </Text>
              </View>
            )}

            <ReviewRow label="Merchant / Payee" value={parsed.merchant || "Unknown"} icon="user" />
            <ReviewRow
              label="Amount"
              value={`₹${Number(parsed.amount).toFixed(2)}`}
              icon="credit-card"
              valueColor={parsed.type === "INCOME" ? Colors.income : Colors.expense}
            />
            <ReviewRow label="Category" value={parsed.suggestedCategory || "Other"} icon="grid" />
            <ReviewRow
              label="Date"
              value={parsed.date ? new Date(parsed.date).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN")}
              icon="calendar"
            />

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

// ── Manual paste input sub-component ──────────────────────────────────────────
function ManualInput({
  smsText, onChangeText, onClear, onParse, parsing,
}: {
  smsText: string;
  onChangeText: (t: string) => void;
  onClear: () => void;
  onParse: () => void;
  parsing: boolean;
}) {
  return (
    <View style={{ width: "100%", marginTop: 20 }}>
      <Text style={styles.label}>Or paste SMS manually</Text>
      <TextInput
        style={styles.smsInput}
        multiline
        numberOfLines={5}
        placeholder={"e.g.\nDebited ₹250.00 from A/C XX1234 to Swiggy on 04-04-2026. Ref No. 123456789"}
        placeholderTextColor={Colors.textSecondary}
        value={smsText}
        onChangeText={onChangeText}
        textAlignVertical="top"
      />
      {smsText.length > 0 && (
        <Pressable style={styles.clearBtn} onPress={onClear}>
          <Feather name="x-circle" size={15} color={Colors.textSecondary} />
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>
      )}
      <Pressable
        style={[styles.parseBtn, (!smsText.trim() || parsing) && styles.parseBtnDisabled]}
        onPress={onParse}
        disabled={!smsText.trim() || parsing}
      >
        {parsing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="zap" size={17} color="#fff" />
            <Text style={styles.parseBtnText}>Extract Details</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

// ── Review row ─────────────────────────────────────────────────────────────────
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

// ── Styles ─────────────────────────────────────────────────────────────────────
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

  detectCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    marginHorizontal: 20, padding: 16, backgroundColor: Colors.primary + "10",
    borderRadius: 16, borderWidth: 1, borderColor: Colors.primary + "30", marginBottom: 16,
  },
  detectText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text, flex: 1 },

  centreCard: {
    marginHorizontal: 20, padding: 24, backgroundColor: Colors.card,
    borderRadius: 24, borderWidth: 1, borderColor: Colors.border,
    alignItems: "center", marginBottom: 20,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  cardTitle: {
    fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text,
    textAlign: "center", marginBottom: 10,
  },
  cardSub: {
    fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary,
    textAlign: "center", lineHeight: 22, marginBottom: 20,
  },
  bold: { fontFamily: "Inter_700Bold", color: Colors.text },

  benefitList: { width: "100%", marginBottom: 24, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  benefitText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, flex: 1, lineHeight: 20 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, width: "100%",
    paddingVertical: 16, borderRadius: 16, backgroundColor: Colors.primary,
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  liveChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: Colors.income + "15", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginBottom: 20,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.income },
  liveText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.income },

  supportedRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  bankChip: {
    backgroundColor: Colors.primary + "12", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  bankChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.primary + "10", borderRadius: 12,
    padding: 12, marginBottom: 4, width: "100%",
  },
  infoBoxText: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.text,
    flex: 1, lineHeight: 18,
  },

  label: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.text, marginBottom: 8, alignSelf: "flex-start" },
  smsInput: {
    width: "100%", backgroundColor: Colors.background, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, padding: 14,
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, minHeight: 120, lineHeight: 21,
  },
  clearBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", marginTop: 6, padding: 4,
  },
  clearText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  parseBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary, marginTop: 10,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  reviewCard: {
    marginHorizontal: 20, backgroundColor: Colors.card, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.border, padding: 20, marginBottom: 20,
  },
  reviewHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  reviewHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewHeaderText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.income },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  sourceBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 12, paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.background, borderRadius: 10, alignSelf: "flex-start",
  },
  sourceText: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  reviewRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border + "55",
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
