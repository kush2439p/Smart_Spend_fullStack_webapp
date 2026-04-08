import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { transactionsApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedSms {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  merchant: string;
  suggestedCategory: string;
  date: string;
  rawText: string;
}

interface MonthGroup {
  label: string;       // e.g. "April 2026"
  key: string;         // e.g. "2026-04"
  items: ParsedSms[];
}

type PermState = "unknown" | "requesting" | "granted" | "denied" | "unavailable";
type ScanState = "idle" | "scanning" | "results" | "saving";

// ── Native module loaders (safe — never crash) ─────────────────────────────
let SmsAndroid: any = null;
try { SmsAndroid = require("react-native-get-sms-android"); } catch { SmsAndroid = null; }

let SmsListener: any = null;
try { SmsListener = require("react-native-android-sms-listener").default; } catch { SmsListener = null; }

// ── Bank SMS detection ─────────────────────────────────────────────────────
const BANK_KEYWORDS = [
  "debited", "credited", "rs.", "rs ", "inr", "₹",
  "upi", "phonepe", "gpay", "paytm", "hdfc", "sbi",
  "icici", "axis", "kotak", "paid to", "received from",
  "a/c", "account", "txn", "transaction", "ref no",
  "deducted", "transferred", "neft", "imps", "rtgs",
];

function looksLikeBankSMS(text: string): boolean {
  if (!text || text.length < 15) return false;
  const lower = text.toLowerCase();
  return BANK_KEYWORDS.filter((k) => lower.includes(k)).length >= 2;
}

// ── Improved credit/debit detector ────────────────────────────────────────
// "credited to VPA/merchant" = EXPENSE (you sent money to them)
// "credited to your account/a/c" = INCOME (money received by you)
function detectType(text: string): "INCOME" | "EXPENSE" {
  const lower = text.toLowerCase();
  // Strong EXPENSE signals
  if (
    /\bdebited\b/.test(lower) ||
    /paid to\b/.test(lower) ||
    /transferred to\b/.test(lower) ||
    /\bdeducted\b/.test(lower) ||
    /\bwithdrawn\b/.test(lower) ||
    /\bsent to\b/.test(lower) ||
    /payment.*made/.test(lower) ||
    /credited to\s+(?:vpa\b|[\w.%+-]+@[\w.-]+)/.test(lower) // credited to UPI VPA = you sent
  ) return "EXPENSE";
  // Strong INCOME signals
  if (
    /credited.*(?:your|yr|savings|current|account|a\/c|\bac\b)/.test(lower) ||
    /\breceived from\b/.test(lower) ||
    /\bdeposited\b/.test(lower) ||
    /\brefund\b/.test(lower) ||
    /\bcashback\b/.test(lower) ||
    /\bsalary\b/.test(lower) ||
    /\breward\b/.test(lower)
  ) return "INCOME";
  // Default EXPENSE (most bank SMS are spend alerts)
  return "EXPENSE";
}

// ── Client-side SMS parser ─────────────────────────────────────────────────
function parseSmsFast(text: string, idx: number, smsDate?: number): ParsedSms | null {
  let amount = 0;
  const amountPatterns = [
    /(?:rs\.?|inr|₹)\s*([\d,]+\.?\d*)/i,
    /([\d,]+\.?\d*)\s*(?:debited|credited|deducted|paid)/i,
    /([\d,]+\.\d{2})/,
  ];
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) { amount = parseFloat(m[1].replace(/,/g, "")); if (amount > 0) break; }
  }
  if (amount <= 0) return null;

  const type = detectType(text);

  let merchant = "Unknown";
  const merchantPatterns = [
    /(?:to|at)\s+([A-Za-z][A-Za-z0-9\s&'.,-]{2,40}?)(?:\s+on|\s+for|\.|\,|\s+via|$)/i,
    /vpa\s+([\w.@-]+)/i,
    /([\w.]+@[\w.]+)/,
  ];
  for (const p of merchantPatterns) {
    const m = text.match(p);
    if (m) { merchant = m[1].trim(); break; }
  }

  // Category detection (keywords in merchant + SMS text)
  const searchText = (merchant + " " + text).toLowerCase();
  const categoryMap: [string, string[]][] = [
    ["Food", ["zomato", "swiggy", "restaurant", "food", "cafe", "coffee", "pizza", "burger", "biryani", "blinkit", "zepto", "grofer", "dunzo", "instamart"]],
    ["Transport", ["uber", "ola", "rapido", "petrol", "fuel", "metro", "irctc", "redbus", "flight", "cab", "indigo", "spicejet", "ixigo", "yulu", "bounce"]],
    ["Shopping", ["amazon", "flipkart", "myntra", "ajio", "mall", "shop", "market", "meesho", "nykaa", "tatacliq", "snapdeal"]],
    ["Healthcare", ["pharmacy", "medical", "hospital", "clinic", "doctor", "apollo", "medplus", "practo", "1mg", "netmeds"]],
    ["Utilities", ["electricity", "bescom", "internet", "jio", "airtel", "vodafone", "vi", "bsnl", "gas", "lpg", "water", "broadband", "postpaid", "prepaid", "recharge"]],
    ["Entertainment", ["netflix", "hotstar", "disney", "spotify", "bookmyshow", "cinema", "movie", "pvr", "inox", "amazon prime", "prime video"]],
    ["Salary", ["salary", "wage", "payroll", "stipend", "remuneration"]],
    ["Travel", ["hotel", "makemytrip", "goibibo", "oyo", "airbnb", "travel", "cleartrip", "via.com"]],
    ["Education", ["udemy", "coursera", "byju", "unacademy", "vedantu", "school", "college", "university", "tuition"]],
    ["Rent", ["rent", "lease", "housing", "maintenance", "society", "flat", "pg", "hostel"]],
  ];
  let suggestedCategory = "Other";
  for (const [cat, kws] of categoryMap) {
    if (kws.some((k) => searchText.includes(k))) { suggestedCategory = cat; break; }
  }

  // Date from SMS metadata (most accurate) or text
  let date = new Date().toISOString().split("T")[0];
  if (smsDate && smsDate > 0) {
    const d = new Date(smsDate);
    if (!isNaN(d.getTime())) date = d.toISOString().split("T")[0];
  } else {
    const datePatterns = [/(\d{2}[-\/]\d{2}[-\/]\d{4})/, /(\d{4}-\d{2}-\d{2})/];
    for (const p of datePatterns) {
      const m = text.match(p);
      if (m) {
        try {
          const d = new Date(m[1].replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1"));
          if (!isNaN(d.getTime())) { date = d.toISOString().split("T")[0]; break; }
        } catch {}
      }
    }
  }

  return {
    id: `sms_${idx}_${Date.now()}`,
    amount,
    type,
    merchant,
    suggestedCategory,
    date,
    rawText: text.substring(0, 100),
  };
}

// ── Month grouping ─────────────────────────────────────────────────────────
function groupByMonth(items: ParsedSms[]): MonthGroup[] {
  const map: Record<string, ParsedSms[]> = {};
  for (const item of items) {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a)) // newest first
    .map(([key, its]) => ({
      key,
      label: new Date(key + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      items: its.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }));
}

// ── Batch parallel import (groups of 8) ───────────────────────────────────
async function batchImport(
  items: ParsedSms[],
  onProgress: (done: number, total: number) => void
): Promise<number> {
  const BATCH = 8;
  let saved = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      chunk.map((tx) =>
        transactionsApi.create({
          title: tx.merchant !== "Unknown" ? tx.merchant : "Transaction",
          amount: tx.amount,
          type: tx.type === "INCOME" ? "income" : "expense",
          category: tx.suggestedCategory || "Other",
          date: new Date(tx.date).toISOString(),
          note: "Imported from SMS",
        })
      )
    );
    saved += results.filter((r) => r.status === "fulfilled").length;
    onProgress(Math.min(i + BATCH, items.length), items.length);
  }
  return saved;
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast component
// ═══════════════════════════════════════════════════════════════════════════
function Toast({ message, visible }: { message: string; visible: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: visible ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.toast, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
      <Icon name="check-circle" size={14} color="#fff" />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════════════
export default function SmsScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [permState, setPermState] = useState<PermState>("unknown");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [detected, setDetected] = useState<ParsedSms[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [smsText, setSmsText] = useState("");
  const [manualParsed, setManualParsed] = useState<ParsedSms | null>(null);
  const [manualParsing, setManualParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [autoImportCount, setAutoImportCount] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const smsListenerSub = useRef<any>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Toast helper ──────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  // ── Pulse animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (scanState !== "scanning") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanState]);

  // ── Request permissions ───────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    if (Platform.OS !== "android") { setPermState("unavailable"); return; }
    setPermState("requesting");
    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);
      const granted =
        results["android.permission.RECEIVE_SMS"] === PermissionsAndroid.RESULTS.GRANTED &&
        results["android.permission.READ_SMS"] === PermissionsAndroid.RESULTS.GRANTED;
      setPermState(granted ? "granted" : "denied");
    } catch {
      setPermState("unavailable");
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") requestPermissions();
    else setPermState("unavailable");
  }, []);

  // ── Auto-import: live listener for NEW incoming SMS ───────────────────
  useEffect(() => {
    if (permState !== "granted" || !SmsListener) return;
    try {
      smsListenerSub.current = SmsListener.onSmsReceived(async (msg: { body: string }) => {
        if (!msg?.body || !looksLikeBankSMS(msg.body)) return;
        const parsed = parseSmsFast(msg.body, Date.now());
        if (!parsed) return;
        // Auto-save immediately
        try {
          await transactionsApi.create({
            title: parsed.merchant !== "Unknown" ? parsed.merchant : "Transaction",
            amount: parsed.amount,
            type: parsed.type === "INCOME" ? "income" : "expense",
            category: parsed.suggestedCategory || "Other",
            date: new Date(parsed.date).toISOString(),
            note: "Auto-imported from SMS",
          });
          setAutoImportCount((c) => c + 1);
          queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
          showToast(`Auto-saved: ${parsed.type === "INCOME" ? "+" : "-"}₹${parsed.amount.toFixed(0)} · ${parsed.merchant}`);
        } catch {
          showToast("New transaction detected — open SMS Scanner to review");
        }
      });
    } catch {}
    return () => {
      try { smsListenerSub.current?.remove?.(); } catch {}
      smsListenerSub.current = null;
    };
  }, [permState]);

  // ── BULK SCAN ─────────────────────────────────────────────────────────
  const scanAllSms = useCallback(() => {
    if (!SmsAndroid) {
      Alert.alert("APK Required", "Inbox scanning requires the Android APK build. Use manual paste below.");
      return;
    }
    setScanState("scanning");
    setDetected([]);
    setSelected(new Set());
    try {
      SmsAndroid.list(
        JSON.stringify({ box: "inbox", maxCount: 500 }),
        (err: string) => {
          setScanState("idle");
          Alert.alert("Read Failed", "Could not read SMS. Make sure READ_SMS permission is granted.");
        },
        (_count: number, smsList: string) => {
          try {
            const arr: { body: string; date: number }[] = JSON.parse(smsList);
            const parsed: ParsedSms[] = [];
            arr.forEach((s, i) => {
              if (!looksLikeBankSMS(s.body || "")) return;
              const result = parseSmsFast(s.body, i, s.date);
              if (result) parsed.push(result);
            });
            if (parsed.length === 0) {
              setScanState("idle");
              Alert.alert("No Transactions Found", "No bank or UPI SMS found in your inbox.");
              return;
            }
            setDetected(parsed);
            setSelected(new Set(parsed.map((p) => p.id)));
            setScanState("results");
          } catch {
            setScanState("idle");
            Alert.alert("Error", "Could not process messages. Try manual paste.");
          }
        }
      );
    } catch {
      setScanState("idle");
      Alert.alert("Error", "SMS scanner not available on this device.");
    }
  }, []);

  // ── Manual parse ──────────────────────────────────────────────────────
  const handleManualParse = useCallback(async () => {
    if (!smsText.trim()) return;
    setManualParsing(true);
    setManualParsed(null);
    try {
      const parsed = parseSmsFast(smsText.trim(), 0);
      if (!parsed || parsed.amount <= 0) {
        Alert.alert("Not a Transaction", "This doesn't look like a bank/UPI SMS.");
        return;
      }
      setManualParsed(parsed);
    } catch {
      Alert.alert("Error", "Could not parse this message.");
    } finally {
      setManualParsing(false);
    }
  }, [smsText]);

  // ── Toggle selection ──────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleMonth = (group: MonthGroup) => {
    const allSelected = group.items.every((i) => selected.has(i.id));
    setSelected((prev) => {
      const n = new Set(prev);
      group.items.forEach((i) => allSelected ? n.delete(i.id) : n.add(i.id));
      return n;
    });
  };

  // ── Import selected ───────────────────────────────────────────────────
  const importSelected = async () => {
    const toImport = detected.filter((d) => selected.has(d.id));
    if (toImport.length === 0) { Alert.alert("Nothing Selected", "Tap transactions to select them."); return; }
    setScanState("saving");
    setProgress({ done: 0, total: toImport.length });

    const saved = await batchImport(toImport, (done, total) => setProgress({ done, total }));

    queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });

    const importedIds = new Set(toImport.map((t) => t.id));
    setDetected((prev) => prev.filter((d) => !importedIds.has(d.id)));
    setSelected(new Set());
    setScanState(detected.length - toImport.length > 0 ? "results" : "results");

    Alert.alert(
      saved > 0 ? "Done! 🎉" : "Nothing Saved",
      saved > 0
        ? `${saved} transaction${saved !== 1 ? "s" : ""} imported successfully.`
        : "No transactions could be saved. Please check your connection.",
      [
        { text: "Go to Transactions", onPress: () => router.replace("/(tabs)/transactions") },
        { text: "Stay" },
      ]
    );
  };

  // ── Save single manual parse ──────────────────────────────────────────
  const saveManual = async () => {
    if (!manualParsed) return;
    try {
      await transactionsApi.create({
        title: manualParsed.merchant !== "Unknown" ? manualParsed.merchant : "Transaction",
        amount: manualParsed.amount,
        type: manualParsed.type === "INCOME" ? "income" : "expense",
        category: manualParsed.suggestedCategory || "Other",
        date: new Date(manualParsed.date).toISOString(),
        note: "Imported from SMS (manual)",
      });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      Alert.alert("Saved!", "Transaction added.", [
        { text: "View Transactions", onPress: () => router.replace("/(tabs)/transactions") },
        { text: "Add Another", onPress: () => { setSmsText(""); setManualParsed(null); } },
      ]);
    } catch {
      Alert.alert("Error", "Could not save. Please check your connection.");
    }
  };

  const monthGroups = groupByMonth(detected);

  // ── Render: permission pending ────────────────────────────────────────
  if (permState === "unknown" || permState === "requesting") {
    return (
      <View style={[styles.container, styles.centreBox]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.hint}>Requesting SMS permission…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Toast */}
      <Toast message={toastMsg} visible={toastVisible} />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SMS Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Denied / Unavailable */}
        {(permState === "denied" || permState === "unavailable") && (
          <View style={styles.warningCard}>
            <Icon name="alert-triangle" size={18} color="#E65100" />
            <Text style={styles.warningText}>
              {permState === "denied"
                ? "SMS permission denied. Go to Settings → Apps → SmartSpend → Permissions and enable SMS."
                : "SMS scanning is only available in the Android APK build."}
            </Text>
          </View>
        )}

        {/* Auto-import count */}
        {autoImportCount > 0 && (
          <View style={styles.successBanner}>
            <Icon name="zap" size={16} color={Colors.income} />
            <Text style={styles.successText}>
              {autoImportCount} transaction{autoImportCount !== 1 ? "s" : ""} auto-imported from new SMS this session
            </Text>
          </View>
        )}

        {/* Auto-import tip */}
        {permState === "granted" && SmsListener && (
          <View style={styles.tipCard}>
            <Icon name="info" size={14} color={Colors.primary} />
            <Text style={styles.tipText}>
              Auto-import is ON — new UPI/bank messages will be saved automatically while this screen is open.
            </Text>
          </View>
        )}

        {/* Scan card */}
        {permState === "granted" && scanState === "idle" && (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Icon name="message-square" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Scan Your Messages</Text>
            <Text style={styles.cardSub}>
              Reads your inbox, finds every UPI and bank transaction, and groups them by month so you can select exactly what to import.
            </Text>
            <View style={styles.featureList}>
              {[
                "Reads PhonePe, GPay, Paytm, HDFC, SBI, ICICI & more",
                "Grouped month by month — April, March, February…",
                "Smart detection: debits vs credits vs UPI sends",
              ].map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Icon name="check" size={14} color={Colors.income} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={scanAllSms}
            >
              <Icon name="search" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Scan All Messages</Text>
            </Pressable>
            {!SmsAndroid && (
              <Text style={styles.apkNote}>Requires Android APK build. Manual paste available below.</Text>
            )}
          </View>
        )}

        {/* Scanning */}
        {scanState === "scanning" && (
          <View style={styles.card}>
            <Animated.View style={[styles.iconCircle, { opacity: pulseAnim }]}>
              <Icon name="search" size={36} color={Colors.primary} />
            </Animated.View>
            <Text style={styles.cardTitle}>Scanning Messages…</Text>
            <Text style={styles.cardSub}>Reading inbox and detecting bank transactions.</Text>
            <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Saving progress */}
        {scanState === "saving" && (
          <View style={styles.card}>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.cardTitle}>Saving Transactions…</Text>
            <Text style={styles.cardSub}>
              {progress.done} of {progress.total} saved
            </Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` as any }]} />
            </View>
          </View>
        )}

        {/* Results: month-wise groups */}
        {(scanState === "results") && monthGroups.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>{detected.length} transactions found</Text>
              <View style={styles.resultsActions}>
                <Pressable onPress={() => setSelected(new Set(detected.map((d) => d.id)))}>
                  <Text style={styles.selectAllText}>Select All</Text>
                </Pressable>
                <Text style={{ color: Colors.textSecondary }}> · </Text>
                <Pressable onPress={() => setSelected(new Set())}>
                  <Text style={styles.selectAllText}>None</Text>
                </Pressable>
              </View>
            </View>

            {monthGroups.map((group) => {
              const allSelected = group.items.every((i) => selected.has(i.id));
              const someSelected = group.items.some((i) => selected.has(i.id));
              return (
                <View key={group.key}>
                  {/* Month header */}
                  <Pressable style={styles.monthHeader} onPress={() => toggleMonth(group)}>
                    <View style={[styles.monthCheckbox, allSelected && styles.monthCheckboxChecked, someSelected && !allSelected && styles.monthCheckboxPartial]}>
                      {allSelected && <Icon name="check" size={12} color="#fff" />}
                      {someSelected && !allSelected && <View style={styles.partialDot} />}
                    </View>
                    <Text style={styles.monthLabel}>{group.label}</Text>
                    <Text style={styles.monthCount}>{group.items.length} txns · {group.items.filter(i => selected.has(i.id)).length} selected</Text>
                  </Pressable>

                  {/* Transactions in this month */}
                  {group.items.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.txCard, selected.has(item.id) && styles.txCardSelected]}
                      onPress={() => toggleSelect(item.id)}
                    >
                      <View style={[styles.checkbox, selected.has(item.id) && styles.checkboxChecked]}>
                        {selected.has(item.id) && <Icon name="check" size={11} color="#fff" />}
                      </View>
                      <View style={styles.txInfo}>
                        <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant}</Text>
                        <Text style={styles.txMeta}>{item.suggestedCategory} · {new Date(item.date).toLocaleDateString("en-IN")}</Text>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={[styles.txAmount, { color: item.type === "INCOME" ? Colors.income : Colors.expense }]}>
                          {item.type === "INCOME" ? "+" : "-"}₹{item.amount.toFixed(0)}
                        </Text>
                        <View style={[styles.typeBadge, { backgroundColor: item.type === "INCOME" ? Colors.income + "18" : Colors.expense + "18" }]}>
                          <Text style={[styles.typeBadgeText, { color: item.type === "INCOME" ? Colors.income : Colors.expense }]}>
                            {item.type === "INCOME" ? "Credit" : "Debit"}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              );
            })}

            <Pressable
              style={[styles.importBtn, selected.size === 0 && styles.importBtnDisabled]}
              onPress={importSelected}
              disabled={selected.size === 0}
            >
              <Icon name="download" size={18} color="#fff" />
              <Text style={styles.importBtnText}>Import {selected.size} Transaction{selected.size !== 1 ? "s" : ""}</Text>
            </Pressable>
            <Pressable style={styles.rescanBtn} onPress={() => { setScanState("idle"); setDetected([]); setSelected(new Set()); }}>
              <Text style={styles.rescanText}>Scan Again</Text>
            </Pressable>
          </>
        )}

        {/* All done */}
        {scanState === "results" && detected.length === 0 && monthGroups.length === 0 && (
          <View style={styles.card}>
            <Icon name="check-circle" size={40} color={Colors.income} style={{ marginBottom: 12 }} />
            <Text style={styles.cardTitle}>All Done!</Text>
            <Text style={styles.cardSub}>All transactions have been imported.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => { setScanState("idle"); }}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
            </Pressable>
          </View>
        )}

        {/* ── Manual paste ──────────────────────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>Or paste a single SMS</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.manualCard}>
          <TextInput
            style={styles.smsInput}
            multiline
            numberOfLines={5}
            placeholder={"e.g.\nDebited ₹250.00 from A/C XX1234 to Swiggy on 04-04-2026. Ref No. 123456"}
            placeholderTextColor={Colors.textSecondary}
            value={smsText}
            onChangeText={(t) => { setSmsText(t); setManualParsed(null); }}
            textAlignVertical="top"
          />
          {smsText.length > 0 && (
            <Pressable style={styles.clearBtn} onPress={() => { setSmsText(""); setManualParsed(null); }}>
              <Icon name="x-circle" size={14} color={Colors.textSecondary} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.parseBtn, (!smsText.trim() || manualParsing) && styles.parseBtnDisabled]}
            onPress={handleManualParse}
            disabled={!smsText.trim() || manualParsing}
          >
            {manualParsing ? <ActivityIndicator color="#fff" size="small" /> : (
              <><Icon name="zap" size={16} color="#fff" /><Text style={styles.parseBtnText}>Extract Details</Text></>
            )}
          </Pressable>

          {manualParsed && (
            <View style={styles.manualResult}>
              <View style={styles.reviewHeader}>
                <Icon name="check-circle" size={15} color={Colors.income} />
                <Text style={styles.reviewHeaderText}>Transaction Detected</Text>
                <View style={[styles.typeBadge, { backgroundColor: manualParsed.type === "INCOME" ? Colors.income + "18" : Colors.expense + "18" }]}>
                  <Text style={[styles.typeBadgeText, { color: manualParsed.type === "INCOME" ? Colors.income : Colors.expense }]}>
                    {manualParsed.type === "INCOME" ? "Credit" : "Debit"}
                  </Text>
                </View>
              </View>
              <ReviewRow icon="user" label="Merchant" value={manualParsed.merchant} />
              <ReviewRow icon="credit-card" label="Amount" value={`₹${manualParsed.amount.toFixed(2)}`} valueColor={manualParsed.type === "INCOME" ? Colors.income : Colors.expense} />
              <ReviewRow icon="grid" label="Category" value={manualParsed.suggestedCategory} />
              <ReviewRow icon="calendar" label="Date" value={new Date(manualParsed.date).toLocaleDateString("en-IN")} />
              <Pressable style={styles.saveBtn} onPress={saveManual}>
                <Icon name="plus-circle" size={17} color="#fff" />
                <Text style={styles.saveBtnText}>Save Transaction</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function ReviewRow({ icon, label, value, valueColor }: { icon: string; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewLeft}>
        <Icon name={icon as any} size={13} color={Colors.textSecondary} />
        <Text style={styles.reviewLabel}>{label}</Text>
      </View>
      <Text style={[styles.reviewValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centreBox: { alignItems: "center", justifyContent: "center", gap: 16 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },

  toast: {
    position: "absolute", top: 60, alignSelf: "center", zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.income, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#fff" },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { padding: 8, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },

  warningCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#FFF3E0", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#FFE0B2", marginBottom: 16,
  },
  warningText: { fontFamily: "Inter_400Regular", fontSize: 13, color: "#BF360C", flex: 1, lineHeight: 19 },

  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.income + "15", borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: Colors.income + "30",
  },
  successText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.income, flex: 1 },

  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: Colors.primary + "10", borderRadius: 12, padding: 12,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.primary + "25",
  },
  tipText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.primary, flex: 1, lineHeight: 18 },

  card: {
    backgroundColor: Colors.card, borderRadius: 22, padding: 24,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: 20, gap: 4,
  },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, textAlign: "center", marginBottom: 6 },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 16 },

  featureList: { width: "100%", gap: 10, marginBottom: 20 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, flex: 1, lineHeight: 20 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, width: "100%",
    paddingVertical: 15, borderRadius: 15, backgroundColor: Colors.primary, justifyContent: "center",
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  apkNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, textAlign: "center", marginTop: 10 },

  progressBar: { width: "100%", height: 6, backgroundColor: Colors.border, borderRadius: 4, marginTop: 12, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 4 },

  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  resultsTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  resultsActions: { flexDirection: "row", alignItems: "center" },
  selectAllText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },

  monthHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 12, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  monthCheckbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  monthCheckboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  monthCheckboxPartial: { borderColor: Colors.primary },
  partialDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.primary },
  monthLabel: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.text, flex: 1 },
  monthCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },

  txCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 12,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  txCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  txInfo: { flex: 1, gap: 3 },
  txMerchant: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },
  txMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  txRight: { alignItems: "flex-end", gap: 4 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 14 },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },

  importBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
    marginTop: 12, marginBottom: 10,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  importBtnDisabled: { opacity: 0.45 },
  importBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  rescanBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  rescanText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },

  manualCard: { backgroundColor: Colors.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
  smsInput: {
    backgroundColor: Colors.background, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border, padding: 14, height: 130,
    fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, lineHeight: 20,
  },
  clearBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 6 },
  clearText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  parseBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 12,
  },
  parseBtnDisabled: { opacity: 0.45 },
  parseBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },

  manualResult: { marginTop: 18, gap: 10 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  reviewHeaderText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text, flex: 1 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  reviewLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  reviewLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary },
  reviewValue: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.text },

  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
