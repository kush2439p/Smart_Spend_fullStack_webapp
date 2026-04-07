import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import { Colors } from "@/constants/colors";
import { receiptApi, transactionsApi } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

type Stage = "camera" | "upload" | "processing" | "review";

const PROCESSING_MSGS = [
  "Uploading receipt...",
  "Analyzing with AI...",
  "Extracting details...",
  "Almost done...",
];

const ALL_CATEGORIES = [
  "Food", "Transport", "Shopping", "Entertainment",
  "Healthcare", "Utilities", "Education", "Travel",
  "Groceries", "Dining", "Other",
];

export default function ReceiptScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [stage, setStage] = useState<Stage>(Platform.OS === "web" ? "upload" : "camera");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fileMime, setFileMime] = useState("image/jpeg");
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MSGS[0]);

  // Review fields
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [currency, setCurrency] = useState("INR");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Animated scan line
  const scanAnim = useRef(new Animated.Value(0)).current;
  const [frameHeight, setFrameHeight] = useState(300);

  useEffect(() => {
    if (stage !== "camera") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [stage, scanAnim]);

  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-frameHeight * 0.42, frameHeight * 0.42],
  });

  // Cycling processing messages
  useEffect(() => {
    if (stage !== "processing") return;
    let idx = 0;
    setProcessingMsg(PROCESSING_MSGS[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % PROCESSING_MSGS.length;
      setProcessingMsg(PROCESSING_MSGS[idx]);
    }, 1500);
    return () => clearInterval(interval);
  }, [stage]);

  const resetCapture = useCallback(() => {
    setImageUri(null);
    setFileMime("image/jpeg");
    setMerchant(""); setAmount(""); setDate(""); setCategory("Other");
    setTxType("expense"); setNotes(""); setItems([]); setErrorMsg(null);
    setStage(Platform.OS === "web" ? "upload" : "camera");
  }, []);

  const processReceipt = useCallback(async (uri: string, mime: string) => {
    setStage("processing");
    try {
      const result = await receiptApi.scan(uri, mime);
      if (result.error) {
        setErrorMsg(result.error);
        setStage("review");
        return;
      }
      setMerchant(result.merchant || "");
      setAmount(result.amount ? String(result.amount) : "");
      setDate(result.date || new Date().toISOString().split("T")[0]);
      setCategory(result.category || result.suggestedCategory || "Other");
      setTxType((result.type as "expense" | "income") || "expense");
      setNotes(result.notes || "");
      setItems(result.items || []);
      setCurrency(result.currency || "INR");
    } catch (e: any) {
      setErrorMsg(e?.message || "Could not extract data. Please enter details manually.");
    }
    setStage("review");
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) return;
      setImageUri(photo.uri);
      setFileMime("image/jpeg");
      await processReceipt(photo.uri, "image/jpeg");
    } catch (e) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, [processReceipt]);

  const pickFromGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.length) return;
    const { uri } = result.assets[0];
    setImageUri(uri);
    setFileMime("image/jpeg");
    await processReceipt(uri, "image/jpeg");
  }, [processReceipt]);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const { uri, mimeType } = result.assets[0];
      const mime = mimeType || "image/jpeg";
      setImageUri(uri);
      setFileMime(mime);
      await processReceipt(uri, mime);
    } catch (e) {
      Alert.alert("Error", "Failed to pick file. Please try again.");
    }
  }, [processReceipt]);

  const handleSave = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Validation", "Please enter a valid amount.");
      return;
    }
    if (!merchant.trim()) {
      Alert.alert("Validation", "Please enter a merchant name.");
      return;
    }
    setSaving(true);
    try {
      await transactionsApi.create({
        title: merchant.trim(),
        amount: parseFloat(amount),
        type: txType,
        category,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        note: notes.trim() || "Scanned from receipt",
      });
      queryClient.invalidateQueries({ queryKey: ["dashboardSummary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      Alert.alert("Saved!", "Transaction added from receipt.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [amount, merchant, txType, category, date, notes, queryClient]);

  const topPad = insets.top + (Platform.OS === "web" ? 10 : 0);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── CAMERA STAGE ─────────────────────────────────────────── */}
      {stage === "camera" && (
        <View style={styles.fill}>
          {/* Permission denied */}
          {cameraPermission && !cameraPermission.granted && (
            <View style={styles.permissionBox}>
              <Icon name="camera-off" size={48} color={Colors.textSecondary} />
              <Text style={styles.permTitle}>Camera Access Needed</Text>
              <Text style={styles.permSub}>Allow camera access to scan receipts in real time.</Text>
              <Pressable style={styles.permBtn} onPress={requestCameraPermission}>
                <Text style={styles.permBtnText}>Allow Camera</Text>
              </Pressable>
              <Pressable onPress={() => setStage("upload")} style={{ marginTop: 12 }}>
                <Text style={styles.uploadLink}>Upload a photo instead</Text>
              </Pressable>
            </View>
          )}

          {/* Camera view */}
          {(!cameraPermission || cameraPermission.granted) && (
            <>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="back"
                flash={flash}
              />

              {/* Header overlay */}
              <View style={styles.cameraHeader}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                  <Icon name="arrow-left" size={20} color="#fff" />
                </Pressable>
                <Text style={styles.headerTitle}>Scan Receipt</Text>
                <Pressable
                  style={[styles.flashBtn, flash === "on" && styles.flashBtnOn]}
                  onPress={() => setFlash(f => f === "off" ? "on" : "off")}
                >
                  <Icon name="zap" size={20} color={flash === "on" ? "#FFD700" : "#fff"} />
                </Pressable>
              </View>

              {/* Scan frame */}
              <View style={styles.viewfinder}>
                <View
                  style={styles.scanFrame}
                  onLayout={e => setFrameHeight(e.nativeEvent.layout.height)}
                >
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <Animated.View
                    style={[styles.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]}
                  />
                  <Text style={styles.scanHint}>Position receipt within the frame</Text>
                </View>
              </View>

              {/* Bottom controls */}
              <View style={[styles.cameraActions, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable style={styles.sideBtn} onPress={pickFromGallery}>
                  <Icon name="image" size={22} color="#fff" />
                  <Text style={styles.sideBtnLabel}>Gallery</Text>
                </Pressable>
                <Pressable style={styles.captureBtn} onPress={capturePhoto}>
                  <View style={styles.captureBtnInner} />
                </Pressable>
                <Pressable style={styles.sideBtn} onPress={pickDocument}>
                  <Icon name="file-text" size={22} color="#fff" />
                  <Text style={styles.sideBtnLabel}>PDF</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}

      {/* ── UPLOAD STAGE (web or manual) ─────────────────────────── */}
      {stage === "upload" && (
        <View style={styles.fill}>
          <View style={styles.cameraHeader}>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Icon name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>Upload Receipt</Text>
            {Platform.OS !== "web" && (
              <Pressable onPress={() => setStage("camera")}>
                <Icon name="camera" size={22} color={Colors.primary} />
              </Pressable>
            )}
            {Platform.OS === "web" && <View style={{ width: 40 }} />}
          </View>

          <View style={styles.uploadCenter}>
            <View style={styles.uploadIllustration}>
              <Icon name="file-text" size={56} color={Colors.primary} />
            </View>
            <Text style={styles.uploadTitle}>Upload Your Receipt</Text>
            <Text style={styles.uploadSub}>
              Pick a photo or PDF bill from your device and we'll extract all the details automatically.
            </Text>

            <Pressable style={styles.uploadBtn} onPress={pickFromGallery}>
              <Icon name="image" size={20} color="#fff" />
              <Text style={styles.uploadBtnText}>Choose Photo</Text>
            </Pressable>
            <Pressable style={[styles.uploadBtn, styles.uploadBtnOutline]} onPress={pickDocument}>
              <Icon name="file" size={20} color={Colors.primary} />
              <Text style={[styles.uploadBtnText, { color: Colors.primary }]}>
                Upload PDF / Document
              </Text>
            </Pressable>

            <Text style={styles.uploadFormats}>Supports JPG, PNG, PDF</Text>
          </View>
        </View>
      )}

      {/* ── PROCESSING STAGE ─────────────────────────────────────── */}
      {stage === "processing" && (
        <View style={styles.fill}>
          <View style={styles.cameraHeader}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Analyzing...</Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={styles.processingCenter}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.processingThumb}
                contentFit="cover"
              />
            )}
            <View style={styles.processingSpinner}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            <Text style={styles.processingMsg}>{processingMsg}</Text>
            <Text style={styles.processingSub}>
              Using AI to extract merchant, amount, items and category
            </Text>
          </View>
        </View>
      )}

      {/* ── REVIEW STAGE ─────────────────────────────────────────── */}
      {stage === "review" && (
        <>
          <View style={styles.reviewHeader}>
            <Pressable style={styles.backBtn} onPress={resetCapture}>
              <Icon name="arrow-left" size={20} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>Review Receipt</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.reviewContent, { paddingBottom: insets.bottom + 120 }]}
          >
            {/* Error banner */}
            {errorMsg && (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle" size={16} color="#fff" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            {/* Thumbnail */}
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.reviewThumb} contentFit="cover" />
            )}

            {/* AI badge */}
            {!errorMsg && (
              <View style={styles.aiBadge}>
                <Icon name="cpu" size={14} color={Colors.primary} />
                <Text style={styles.aiBadgeText}>AI Extracted — please review and edit if needed</Text>
              </View>
            )}

            {/* Type toggle */}
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeBtn, txType === "expense" && styles.typeBtnExpense]}
                onPress={() => setTxType("expense")}
              >
                <Icon name="arrow-down-circle" size={16} color={txType === "expense" ? "#fff" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, txType === "expense" && { color: "#fff" }]}>Expense</Text>
              </Pressable>
              <Pressable
                style={[styles.typeBtn, txType === "income" && styles.typeBtnIncome]}
                onPress={() => setTxType("income")}
              >
                <Icon name="arrow-up-circle" size={16} color={txType === "income" ? "#fff" : Colors.textSecondary} />
                <Text style={[styles.typeBtnText, txType === "income" && { color: "#fff" }]}>Income</Text>
              </Pressable>
            </View>

            {/* Fields */}
            <View style={styles.card}>
              <ReviewField
                label="Merchant / Store"
                aiExtracted={!!merchant}
                child={
                  <TextInput
                    style={styles.fieldInput}
                    value={merchant}
                    onChangeText={setMerchant}
                    placeholder="e.g. Swiggy, Amazon"
                    placeholderTextColor={Colors.textSecondary}
                  />
                }
              />
              <View style={styles.divider} />
              <ReviewField
                label="Amount"
                aiExtracted={!!amount}
                child={
                  <View style={styles.amountRow}>
                    <Text style={styles.currencySymbol}>{currency === "INR" ? "₹" : "$"}</Text>
                    <TextInput
                      style={[styles.fieldInput, styles.amountInput]}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                }
              />
              <View style={styles.divider} />
              <ReviewField
                label="Date"
                aiExtracted={!!date}
                child={
                  <TextInput
                    style={styles.fieldInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textSecondary}
                  />
                }
              />
              <View style={styles.divider} />
              <ReviewField label="Notes" aiExtracted={false} child={
                <TextInput
                  style={styles.fieldInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional note"
                  placeholderTextColor={Colors.textSecondary}
                />
              } />
            </View>

            {/* Category chips */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {ALL_CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextSelected]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Items list */}
            {items.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Detected Items</Text>
                <View style={styles.itemsList}>
                  {items.map((item, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Icon name="check" size={14} color={Colors.primary} />
                      <Text style={styles.itemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          {/* Save / Scan again */}
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable style={styles.scanAgainBtn} onPress={resetCapture}>
              <Icon name="camera" size={16} color={Colors.textSecondary} />
              <Text style={styles.scanAgainText}>Scan Again</Text>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && { opacity: 0.75 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Icon name="check" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>Save Transaction</Text>
                  </>
                )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function ReviewField({
  label,
  aiExtracted,
  child,
}: {
  label: string;
  aiExtracted: boolean;
  child: React.ReactNode;
}) {
  return (
    <View style={styles.reviewFieldWrap}>
      <View style={styles.reviewFieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {aiExtracted && (
          <View style={styles.aiTag}>
            <Text style={styles.aiTagText}>AI</Text>
          </View>
        )}
      </View>
      {child}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0E1A" },
  fill: { flex: 1 },

  // Camera header (overlay on camera, or regular on upload)
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    zIndex: 10,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff" },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  flashBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  flashBtnOn: { backgroundColor: "rgba(255,215,0,0.25)" },

  // Viewfinder
  viewfinder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    zIndex: 5,
  },
  scanFrame: {
    width: "100%",
    aspectRatio: 0.68,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  corner: {
    position: "absolute",
    width: 36, height: 36,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: {
    position: "absolute",
    width: "92%",
    height: 2.5,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  scanHint: {
    position: "absolute",
    bottom: 16,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },

  // Camera bottom controls
  cameraActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 16,
    paddingHorizontal: 32,
    zIndex: 10,
  },
  sideBtn: {
    alignItems: "center",
    gap: 6,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },
  sideBtnLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: "#fff" },
  captureBtn: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 4, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  captureBtnInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },

  // Permission screen
  permissionBox: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 12,
  },
  permTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", marginTop: 8 },
  permSub: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
  permBtn: {
    marginTop: 8, backgroundColor: Colors.primary,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
  },
  permBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  uploadLink: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.primary },

  // Upload stage
  uploadCenter: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 14,
  },
  uploadIllustration: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  uploadTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff" },
  uploadSub: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: Colors.textSecondary, textAlign: "center", lineHeight: 22,
  },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: Colors.primary, paddingHorizontal: 24,
    paddingVertical: 15, borderRadius: 14, width: "100%", justifyContent: "center",
  },
  uploadBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  uploadBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  uploadFormats: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: Colors.textSecondary, marginTop: 4,
  },

  // Processing stage
  processingCenter: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 20,
  },
  processingThumb: {
    width: 120, height: 160, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.primary + "40",
  },
  processingSpinner: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primary + "18",
    alignItems: "center", justifyContent: "center",
  },
  processingMsg: {
    fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", textAlign: "center",
  },
  processingSub: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: Colors.textSecondary, textAlign: "center", lineHeight: 20,
  },

  // Review stage
  reviewContent: { padding: 16, gap: 14 },
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#c0392b", borderRadius: 12, padding: 14,
  },
  errorBannerText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#fff", flex: 1 },
  reviewThumb: {
    width: "100%", height: 140, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  aiBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: Colors.primary + "16", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.primary + "30",
  },
  aiBadgeText: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.primary, flex: 1 },

  // Type toggle
  typeRow: { flexDirection: "row", gap: 10 },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  typeBtnExpense: { backgroundColor: Colors.expense, borderColor: Colors.expense },
  typeBtnIncome: { backgroundColor: Colors.income, borderColor: Colors.income },
  typeBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.textSecondary },

  // Field card
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 12 },
  reviewFieldWrap: { paddingHorizontal: 14, paddingVertical: 12 },
  reviewFieldHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  fieldLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.8 },
  aiTag: {
    backgroundColor: Colors.primary + "25",
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  aiTagText: { fontFamily: "Inter_700Bold", fontSize: 9, color: Colors.primary },
  fieldInput: {
    fontFamily: "Inter_500Medium", fontSize: 15, color: "#fff",
    padding: 0, minHeight: 24,
  },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  currencySymbol: { fontFamily: "Inter_700Bold", fontSize: 18, color: Colors.expense },
  amountInput: { color: Colors.expense, fontFamily: "Inter_700Bold", fontSize: 18 },

  // Category chips
  sectionLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 13,
    color: Colors.textSecondary, marginTop: 4,
  },
  catScroll: { marginHorizontal: -4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  catChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.textSecondary },
  catChipTextSelected: { color: "#fff" },

  // Items
  itemsList: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12, padding: 12, gap: 8,
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Bottom bar
  bottomBar: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: "#12111f",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  scanAgainBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  scanAgainText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 14,
  },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
});
