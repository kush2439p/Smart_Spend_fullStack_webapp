import React, { useState, useEffect } from "react";
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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Colors } from "@/constants/colors";
import { receiptApi, transactionsApi, ReceiptScanResult } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

type Stage = "camera" | "processing" | "review";

export default function ReceiptScannerScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ReceiptScanResult | null>(null);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // Ask for permissions early, so the UI doesn't look "stuck" before tapping buttons.
  useEffect(() => {
    (async () => {
      try {
        await ImagePicker.requestCameraPermissionsAsync();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      } catch {}
    })();
  }, []);

  const pickImage = async (fromCamera: boolean) => {
    try {
      console.log(`Starting image pick from ${fromCamera ? 'camera' : 'library'}`);
      
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      console.log('Permissions granted:', perm.granted);

      if (!perm.granted) {
        Alert.alert("Permission Required", "Please grant access to continue.");
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ 
            quality: 0.8, 
            base64: false,
            mediaTypes: ImagePicker.MediaTypeOptions.Images
          })
        : await ImagePicker.launchImageLibraryAsync({ 
            quality: 0.8, 
            mediaTypes: ImagePicker.MediaTypeOptions.Images 
          });

      console.log('Image picker result:', result);

      if (result.canceled) {
        console.log('User cancelled image selection');
        return;
      }
      
      if (!result.assets || result.assets.length === 0) {
        console.log('No assets returned');
        Alert.alert("Error", "No image selected. Please try again.");
        return;
      }
      
      const uri = result.assets[0].uri;
      console.log('Image URI:', uri);
      setImageUri(uri);
      setStage("processing");
      await processReceipt(uri);
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const processReceipt = async (uri: string) => {
    try {
      const result = await receiptApi.scan(uri);
      setScanResult(result);
      setAmount(String(result.amount));
      setMerchant(result.merchant);
      setDate(result.date);
      setCategory(result.suggestedCategory);
    } catch {
      // Mock fallback
      const mock: ReceiptScanResult = {
        amount: 36.5,
        merchant: "Starbucks Coffee",
        date: new Date().toISOString().split("T")[0],
        suggestedCategory: "Food",
      };
      setScanResult(mock);
      setAmount(String(mock.amount));
      setMerchant(mock.merchant);
      setDate(mock.date);
      setCategory(mock.suggestedCategory);
    }
    setStage("review");
  };

  const handleSave = async () => {
    if (!amount || !merchant || !category) {
      Alert.alert("Validation", "Please fill in amount, merchant, and category");
      return;
    }
    
    setSaving(true);
    try {
      await transactionsApi.create({
        title: merchant,
        amount: parseFloat(amount),
        type: "expense",
        category,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        note: "Scanned from receipt",
      });
      
      // Refresh dashboard data
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      
      Alert.alert("Success!", "Transaction saved from receipt scan.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Failed to save transaction:", error);
      Alert.alert("Saved (Mock)", "Transaction will be saved when backend is connected.", [
        { text: "Done", onPress: () => router.back() },
      ]);
      // Still refresh dashboard even for mock data
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Scan Receipt</Text>
        <Feather name="zap" size={22} color={Colors.primary} />
      </View>

      {stage === "camera" && (
        <View style={styles.cameraStage}>
          {/* Fake camera viewfinder */}
          <View style={styles.viewfinder}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Text style={styles.scanHint}>Position receipt within the frame</Text>
              <View style={styles.scanLine} />
            </View>
          </View>

          <View style={styles.cameraActions}>
            <Pressable style={styles.galleryBtn} onPress={() => pickImage(false)}>
              <Feather name="image" size={22} color={Colors.text} />
            </Pressable>
            <Pressable style={styles.captureBtn} onPress={() => pickImage(true)}>
              <View style={styles.captureBtnInner} />
            </Pressable>
            <Pressable style={styles.flashBtn}>
              <Feather name="zap" size={22} color={Colors.text} />
            </Pressable>
          </View>
        </View>
      )}

      {stage === "processing" && (
        <View style={styles.processingStage}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
          )}
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.processingTitle}>Analyzing Receipt</Text>
            <ProcessingStep icon="upload" label="Uploading Image" done />
            <ProcessingStep icon="cpu" label="Detecting Items" done />
            <ProcessingStep icon="tag" label="Extracting Details" active />
          </View>
        </View>
      )}

      {stage === "review" && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.reviewContent, { paddingBottom: insets.bottom + 100 }]}
        >
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.reviewImage} contentFit="cover" />
          )}

          <View style={styles.categoryBadge}>
            <Feather name="check-circle" size={16} color={Colors.income} />
            <Text style={styles.categoryBadgeText}>Suggested: {category}</Text>
            <Pressable style={styles.changeCatBtn}>
              <Text style={styles.changeCatText}>Change Category</Text>
            </Pressable>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>General Information</Text>

            <View style={styles.resultField}>
              <Text style={styles.resultLabel}>Merchant</Text>
              <TextInput
                style={styles.resultInput}
                value={merchant}
                onChangeText={setMerchant}
              />
              <Feather name="check-circle" size={16} color={Colors.income} />
            </View>
            <View style={styles.resultField}>
              <Text style={styles.resultLabel}>Date & Time</Text>
              <TextInput
                style={styles.resultInput}
                value={date}
                onChangeText={setDate}
              />
              <Feather name="check-circle" size={16} color={Colors.income} />
            </View>
            <View style={styles.resultField}>
              <Text style={styles.resultLabel}>Currency</Text>
              <Text style={styles.resultValue}>INR (₹)</Text>
              <Feather name="check-circle" size={16} color={Colors.income} />
            </View>

            <Text style={[styles.resultTitle, { marginTop: 16 }]}>Financials</Text>
            <View style={styles.resultField}>
              <Text style={styles.resultLabel}>Total Amount</Text>
              <TextInput
                style={[styles.resultInput, { color: Colors.expense, fontFamily: "Inter_700Bold" }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
              <Feather name="check-circle" size={16} color={Colors.income} />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Bar */}
      {stage === "review" && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={styles.retakeBtn} onPress={() => { setStage("camera"); setImageUri(null); setScanResult(null); }}>
            <Feather name="camera" size={16} color={Colors.textSecondary} />
            <Text style={styles.retakeBtnText}>Retake Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.saveBtn, { opacity: saving ? 0.85 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Save as Transaction</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ProcessingStep({ icon, label, done, active }: { icon: string; label: string; done?: boolean; active?: boolean }) {
  return (
    <View style={styles.processingStep}>
      <View style={[styles.stepIcon, done && { backgroundColor: Colors.income + "20" }, active && { backgroundColor: Colors.primary + "20" }]}>
        {done ? (
          <Feather name="check" size={14} color={Colors.income} />
        ) : active ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Feather name={icon as any} size={14} color={Colors.textSecondary} />
        )}
      </View>
      <Text style={[styles.stepLabel, done && { color: Colors.income }, active && { color: Colors.primary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F0E1A" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  cameraStage: { flex: 1 },
  viewfinder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  scanFrame: {
    width: "100%",
    aspectRatio: 0.7,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  corner: { position: "absolute", width: 32, height: 32, borderColor: Colors.primary, borderWidth: 3 },
  cornerTL: { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.5)", position: "absolute", bottom: 40 },
  scanLine: { position: "absolute", width: "90%", height: 2, backgroundColor: Colors.primary + "80" },
  cameraActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40, paddingBottom: 48, paddingTop: 24 },
  galleryBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#fff" },
  flashBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  processingStage: { flex: 1, position: "relative" },
  previewImage: { width: "100%", height: 300 },
  processingOverlay: { flex: 1, padding: 32, gap: 16, alignItems: "center" },
  processingTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.textDark, marginBottom: 8 },
  processingStep: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%" },
  stepIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  stepLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  reviewContent: { padding: 20 },
  reviewImage: { width: "100%", height: 200, borderRadius: 16, marginBottom: 16 },
  categoryBadge: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.income + "15", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: Colors.income + "30" },
  categoryBadgeText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.income, flex: 1 },
  changeCatBtn: {},
  changeCatText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },
  resultCard: { backgroundColor: Colors.cardDark, borderRadius: 16, padding: 16, gap: 14 },
  resultTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: Colors.textDark },
  resultField: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultLabel: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondaryDark, width: 90 },
  resultInput: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textDark, borderBottomWidth: 1, borderBottomColor: Colors.borderDark, paddingVertical: 4 },
  resultValue: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textDark },
  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12, backgroundColor: Colors.cardDark, borderTopWidth: 1, borderTopColor: Colors.borderDark },
  retakeBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderDark },
  retakeBtnText: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.textSecondary },
  saveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 14 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});
