import React, { useState } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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

export default function SmsScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [smsText, setSmsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSms | null>(null);
  const [saving, setSaving] = useState(false);

  const handleParse = async () => {
    if (!smsText.trim()) {
      Alert.alert("Empty", "Please paste an SMS message first.");
      return;
    }
    setParsing(true);
    setParsed(null);
    try {
      const result = await smsApi.parse(smsText.trim(), new Date().toISOString());
      setParsed(result as unknown as ParsedSms);
    } catch {
      Alert.alert("Parse Error", "Could not read this SMS. Make sure it's a bank or UPI transaction message.");
    } finally {
      setParsing(false);
    }
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
      Alert.alert("Saved!", "Transaction added successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Could not save the transaction. Please try again.");
    } finally {
      setSaving(false);
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

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Feather name="message-square" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>
            Copy any bank or UPI SMS (PhonePe, GPay, HDFC, SBI, ICICI...) and paste it below. We'll detect the amount, merchant, and category automatically.
          </Text>
        </View>

        {/* SMS Examples */}
        <View style={styles.examplesSection}>
          <Text style={styles.examplesTitle}>Works with messages like:</Text>
          <View style={styles.exampleChip}>
            <Text style={styles.exampleText}>PhonePe: Rs.250 paid to Swiggy</Text>
          </View>
          <View style={styles.exampleChip}>
            <Text style={styles.exampleText}>HDFC: Rs.1,500 debited from A/C XX1234</Text>
          </View>
          <View style={styles.exampleChip}>
            <Text style={styles.exampleText}>SBI: Salary credited Rs.45,000</Text>
          </View>
        </View>

        {/* SMS Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Paste Your SMS</Text>
          <TextInput
            style={styles.smsInput}
            multiline
            numberOfLines={6}
            placeholder={"Paste your bank or UPI SMS here...\n\ne.g.\nDebited INR 250.00 from A/C XX1234 to Swiggy on 04-04-2026. Ref No. 123456789"}
            placeholderTextColor={Colors.textSecondary}
            value={smsText}
            onChangeText={(t) => { setSmsText(t); setParsed(null); }}
            textAlignVertical="top"
          />
          {smsText.length > 0 && (
            <Pressable style={styles.clearBtn} onPress={() => { setSmsText(""); setParsed(null); }}>
              <Feather name="x-circle" size={16} color={Colors.textSecondary} />
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {/* Parse Button */}
        <Pressable
          style={[styles.parseBtn, (!smsText.trim() || parsing) && styles.parseBtnDisabled]}
          onPress={handleParse}
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

        {/* Review Card */}
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

            <ReviewRow
              label="Merchant / Payee"
              value={parsed.merchant || "Unknown"}
              icon="user"
            />
            <ReviewRow
              label="Amount"
              value={`₹${Number(parsed.amount).toFixed(2)}`}
              icon="credit-card"
              valueColor={parsed.type === "INCOME" ? Colors.income : Colors.expense}
            />
            <ReviewRow
              label="Category"
              value={parsed.suggestedCategory || "Other"}
              icon="grid"
            />
            <ReviewRow
              label="Date"
              value={parsed.date || new Date().toLocaleDateString()}
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

            <Pressable
              style={styles.tryAnotherBtn}
              onPress={() => { setSmsText(""); setParsed(null); }}
            >
              <Text style={styles.tryAnotherText}>Scan Another SMS</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.reviewRow}>
      <View style={styles.reviewRowLeft}>
        <Feather name={icon as any} size={14} color={Colors.textSecondary} />
        <Text style={styles.reviewLabel}>{label}</Text>
      </View>
      <Text style={[styles.reviewValue, valueColor ? { color: valueColor } : {}]}>
        {value}
      </Text>
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
  backBtn: {
    padding: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.text },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: Colors.primary + "12",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary + "25",
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },

  examplesSection: { marginHorizontal: 20, marginBottom: 20, gap: 8 },
  examplesTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  exampleChip: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exampleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },

  inputSection: { marginHorizontal: 20, marginBottom: 16 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
    marginBottom: 8,
  },
  smsInput: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    minHeight: 140,
    lineHeight: 22,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
    marginTop: 8,
    padding: 4,
  },
  clearText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },

  parseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    marginBottom: 24,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },

  reviewCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 20,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reviewHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.income,
  },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  typeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  reviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "60",
  },
  reviewRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  reviewValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    maxWidth: "55%" as any,
    textAlign: "right",
  },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  tryAnotherBtn: { alignItems: "center", paddingVertical: 14 },
  tryAnotherText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
