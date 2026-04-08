import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
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

// ── Client-side SMS parser (fast, no API call needed for bulk) ─────────────
function parseSmsFast(text: string, idx: number): ParsedSms | null {
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

  const lower = text.toLowerCase();
  const type: "INCOME" | "EXPENSE" =
    /credited|received|deposited|refund|cashback|salary/.test(lower) ? "INCOME" : "EXPENSE";

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

  const categories: Record<string, string[]> = {
    Food: ["zomato", "swiggy", "restaurant", "food", "cafe", "coffee", "pizza", "burger", "biryani"],
    Transport: ["uber", "ola", "rapido", "petrol", "fuel", "metro", "irctc", "redbus", "flight", "cab"],
    Shopping: ["amazon", "flipkart", "myntra", "ajio", "mall", "shop", "market"],
    Healthcare: ["pharmacy", "medical", "hospital", "clinic", "doctor", "apollo", "medplus"],
    Utilities: ["electricity", "bescom", "internet", "jio", "airtel", "vodafone", "gas", "lpg", "water"],
    Entertainment: ["netflix", "hotstar", "spotify", "bookmyshow", "cinema", "movie", "pvr"],
    Salary: ["salary", "wage", "payroll", "stipend"],
    Travel: ["hotel", "makemytrip", "goibibo", "oyo", "airbnb", "travel"],
  };
  let suggestedCategory = "Other";
  const searchText = (merchant + " " + text).toLowerCase();
  for (const [cat, kws] of Object.entries(categories)) {
    if (kws.some((k) => searchText.includes(k))) { suggestedCategory = cat; break; }
  }

  let date = new Date().toISOString().split("T")[0];
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

// ═══════════════════════════════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════════════════════════════
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
  const [savedCount, setSavedCount] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const smsListenerSub = useRef<any>(null);

  // ── Pulse animation ──────────────────────────────────────────────────────
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

  // ── Request permissions ──────────────────────────────────────────────────
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

  // ── Live SMS listener (for new incoming SMS while screen is open) ────────
  useEffect(() => {
    if (permState !== "granted" || !SmsListener) return;
    try {
      smsListenerSub.current = SmsListener.onSmsReceived((msg: { body: string }) => {
        if (!msg?.body || !looksLikeBankSMS(msg.body)) return;
        const parsed = parseSmsFast(msg.body, Date.now());
        if (parsed) {
          setDetected((prev) => {
            const next = [parsed, ...prev];
            setSelected((s) => { const ns = new Set(s); ns.add(parsed.id); return ns; });
            setScanState("results");
            return next;
          });
        }
      });
    } catch (e) {
      // SmsListener failed silently — bulk scan still works
    }
    return () => {
      try { smsListenerSub.current?.remove?.(); } catch {}
      smsListenerSub.current = null;
    };
  }, [permState]);

  // ── BULK SCAN ────────────────────────────────────────────────────────────
  const scanAllSms = useCallback(() => {
    if (!SmsAndroid) {
      Alert.alert(
        "Not Supported",
        "Inbox scanning requires the full Android APK build. Please use manual paste below.",
      );
      return;
    }
    setScanState("scanning");
    setDetected([]);
    setSelected(new Set());

    try {
      SmsAndroid.list(
        JSON.stringify({ box: "inbox", maxCount: 500 }),
        (err: string) => {
          console.warn("SMS read error:", err);
          setScanState("idle");
          Alert.alert("Read Failed", "Could not read SMS. Make sure READ_SMS permission is granted.");
        },
        (_count: number, smsList: string) => {
          try {
            const arr: { body: string; date: number }[] = JSON.parse(smsList);
            const bankSms = arr.filter((s) => looksLikeBankSMS(s.body || ""));
            const parsed: ParsedSms[] = [];
            bankSms.forEach((s, i) => {
              const result = parseSmsFast(s.body, i);
              if (result) {
                // Override date with actual SMS date if available
                if (s.date) {
                  const d = new Date(s.date);
                  if (!isNaN(d.getTime())) result.date = d.toISOString().split("T")[0];
                }
                parsed.push(result);
              }
            });

            if (parsed.length === 0) {
              setScanState("idle");
              Alert.alert("No Transactions Found", "No bank or UPI transaction messages were found in your inbox.");
              return;
            }

            setDetected(parsed);
            setSelected(new Set(parsed.map((p) => p.id)));
            setScanState("results");
          } catch (e) {
            setScanState("idle");
            Alert.alert("Parse Error", "Could not process SMS messages. Please try manual paste.");
          }
        },
      );
    } catch (e) {
      setScanState("idle");
      Alert.alert("Error", "SMS scanner is not available on this device.");
    }
  }, []);

  // ── Manual parse (single SMS paste) ─────────────────────────────────────
  const handleManualParse = useCallback(async () => {
    if (!smsText.trim()) { Alert.alert("Empty", "Please paste an SMS first."); return; }
    setManualParsing(true);
    setManualParsed(null);
    try {
      const parsed = parseSmsFast(smsText.trim(), 0);
      if (!parsed || parsed.amount <= 0) {
        Alert.alert("Not a Transaction", "This doesn't look like a bank/UPI transaction SMS. Please try a different message.");
        return;
      }
      setManualParsed(parsed);
    } catch {
      Alert.alert("Error", "Could not parse this SMS. Try a different message.");
    } finally {
      setManualParsing(false);
    }
  }, [smsText]);

  // ── Toggle selection ─────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Import selected transactions ─────────────────────────────────────────
  const importSelected = async () => {
    const toImport = detected.filter((d) => selected.has(d.id));
    if (toImport.length === 0) { Alert.alert("Nothing Selected", "Tap transactions to select them."); return; }
    setScanState("saving");
    let saved = 0;
    for (const tx of toImport) {
      try {
        await transactionsApi.create({
          title: tx.merchant !== "Unknown" ? tx.merchant : "Transaction",
          amount: tx.amount,
          type: tx.type === "INCOME" ? "income" : "expense",
          category: tx.suggestedCategory || "Other",
          date: new Date(tx.date).toISOString(),
          note: "Imported from SMS",
        });
        saved++;
      } catch {}
    }
    setScanState("results");
    setSavedCount(saved);
    queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    // Remove saved items from list
    const importedIds = new Set(toImport.map((t) => t.id));
    setDetected((prev) => prev.filter((d) => !importedIds.has(d.id)));
    setSelected(new Set());
    Alert.alert(
      "Done! 🎉",
      `${saved} transaction${saved !== 1 ? "s" : ""} imported successfully.`,
      [{ text: "Go to Dashboard", onPress: () => router.replace("/(tabs)") }, { text: "Stay" }],
    );
  };

  // ── Save single manual parse ─────────────────────────────────────────────
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
        { text: "Done", onPress: () => router.back() },
        { text: "Scan Another", onPress: () => { setSmsText(""); setManualParsed(null); } },
      ]);
    } catch {
      Alert.alert("Error", "Could not save. Please try again.");
    }
  };

  // ── Render: permission state ─────────────────────────────────────────────
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
        {/* Denied / Unavailable banner */}
        {(permState === "denied" || permState === "unavailable") && (
          <View style={styles.warningCard}>
            <Icon name="alert-triangle" size={18} color="#E65100" />
            <Text style={styles.warningText}>
              {permState === "denied"
                ? "SMS permission denied. Go to Settings → Apps → SmartSpend → Permissions and enable SMS, then come back."
                : "SMS reading is only available on Android with a native APK build."}
            </Text>
          </View>
        )}

        {/* Saved count badge */}
        {savedCount > 0 && (
          <View style={styles.successBanner}>
            <Icon name="check-circle" size={16} color={Colors.income} />
            <Text style={styles.successText}>{savedCount} transaction{savedCount !== 1 ? "s" : ""} imported this session</Text>
          </View>
        )}

        {/* Main scan card */}
        {permState === "granted" && scanState === "idle" && (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Icon name="message-square" size={36} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Scan Your Messages</Text>
            <Text style={styles.cardSub}>
              SmartSpend will scan your inbox for UPI, bank, and wallet messages and automatically detect all your transactions.
            </Text>
            <View style={styles.featureList}>
              {[
                "Reads PhonePe, GPay, Paytm, HDFC, SBI, ICICI & more",
                "Detects credits and debits automatically",
                "You choose which ones to import",
              ].map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Icon name="check" size={14} color={Colors.income} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={SmsAndroid ? scanAllSms : () => Alert.alert("APK Required", "Inbox scanning requires the full Android APK build. Use manual paste below.")}
            >
              <Icon name="search" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Scan All Messages</Text>
            </Pressable>
            {!SmsAndroid && (
              <Text style={styles.apkNote}>
                Full inbox scan requires the Android APK build. Use manual paste below in Expo Go.
              </Text>
            )}
          </View>
        )}

        {/* Scanning state */}
        {scanState === "scanning" && (
          <View style={styles.card}>
            <Animated.View style={[styles.iconCircle, { opacity: pulseAnim }]}>
              <Icon name="search" size={36} color={Colors.primary} />
            </Animated.View>
            <Text style={styles.cardTitle}>Scanning Messages…</Text>
            <Text style={styles.cardSub}>Reading your inbox and detecting bank transactions. This takes a moment.</Text>
            <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 8 }} />
          </View>
        )}

        {/* Results */}
        {scanState === "results" && detected.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>{detected.length} transaction{detected.length !== 1 ? "s" : ""} found</Text>
              <View style={styles.resultsActions}>
                <Pressable onPress={() => setSelected(new Set(detected.map((d) => d.id)))}>
                  <Text style={styles.selectAllText}>All</Text>
                </Pressable>
                <Text style={{ color: Colors.textSecondary }}> · </Text>
                <Pressable onPress={() => setSelected(new Set())}>
                  <Text style={styles.selectAllText}>None</Text>
                </Pressable>
              </View>
            </View>

            {detected.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.txCard, selected.has(item.id) && styles.txCardSelected]}
                onPress={() => toggleSelect(item.id)}
              >
                <View style={styles.txCheck}>
                  <View style={[styles.checkbox, selected.has(item.id) && styles.checkboxChecked]}>
                    {selected.has(item.id) && <Icon name="check" size={12} color="#fff" />}
                  </View>
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txMerchant} numberOfLines={1}>{item.merchant}</Text>
                  <Text style={styles.txRaw} numberOfLines={1}>{item.rawText}</Text>
                  <Text style={styles.txMeta}>{item.suggestedCategory} · {item.date}</Text>
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

            <Pressable
              style={[styles.importBtn, (scanState === "saving" || selected.size === 0) && styles.importBtnDisabled]}
              onPress={importSelected}
              disabled={scanState === "saving" || selected.size === 0}
            >
              {scanState === "saving" ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Icon name="download" size={18} color="#fff" />
                  <Text style={styles.importBtnText}>
                    Import {selected.size} Selected Transaction{selected.size !== 1 ? "s" : ""}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.rescanBtn}
              onPress={() => { setScanState("idle"); setDetected([]); setSelected(new Set()); }}
            >
              <Text style={styles.rescanText}>Scan Again</Text>
            </Pressable>
          </>
        )}

        {/* No results after scan */}
        {scanState === "results" && detected.length === 0 && (
          <View style={styles.card}>
            <Icon name="inbox" size={36} color={Colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={styles.cardTitle}>All Done!</Text>
            <Text style={styles.cardSub}>All detected transactions have been imported.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => { setScanState("idle"); setDetected([]); }}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
            </Pressable>
          </View>
        )}

        {/* ── Manual paste section ────────────────────────────────────────── */}
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
            {manualParsing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="zap" size={16} color="#fff" />
                <Text style={styles.parseBtnText}>Extract Details</Text>
              </>
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

// ── Sub-components ─────────────────────────────────────────────────────────
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

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centreBox: { alignItems: "center", justifyContent: "center", gap: 16 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
  },
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
    marginBottom: 16, borderWidth: 1, borderColor: Colors.income + "30",
  },
  successText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.income },

  card: {
    backgroundColor: Colors.card, borderRadius: 22, padding: 24,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center", marginBottom: 20,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary + "15",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text, textAlign: "center", marginBottom: 8 },
  cardSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 20 },

  featureList: { width: "100%", gap: 10, marginBottom: 24 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.text, flex: 1, lineHeight: 20 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, width: "100%",
    paddingVertical: 15, borderRadius: 15, backgroundColor: Colors.primary, justifyContent: "center",
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  apkNote: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, textAlign: "center", marginTop: 12 },

  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  resultsTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  resultsActions: { flexDirection: "row", alignItems: "center" },
  selectAllText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },

  txCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.card, borderRadius: 16, padding: 14,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 10,
  },
  txCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  txCheck: { justifyContent: "center" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  txInfo: { flex: 1, gap: 3 },
  txMerchant: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.text },
  txRaw: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  txMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary },
  txRight: { alignItems: "flex-end", gap: 4 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  importBtn: {
    flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center",
    backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16,
    marginTop: 8, marginBottom: 12,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  rescanBtn: { alignItems: "center", paddingVertical: 10, marginBottom: 8 },
  rescanText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },

  manualCard: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
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
