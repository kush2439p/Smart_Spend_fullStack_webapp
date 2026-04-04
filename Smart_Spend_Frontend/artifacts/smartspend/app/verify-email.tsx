import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { token: urlToken, email: paramEmail } = useLocalSearchParams();
  const [resolvedEmail, setResolvedEmail] = useState<string>("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    // Resolve email: from nav param or from AsyncStorage
    const loadEmail = async () => {
      if (typeof paramEmail === "string" && paramEmail) {
        setResolvedEmail(paramEmail);
      } else {
        const stored = await AsyncStorage.getItem("pending_verify_email");
        if (stored) setResolvedEmail(stored);
      }
    };
    loadEmail();
  }, [paramEmail]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!resolvedEmail) {
      Alert.alert("Error", "Email address not found. Please go back and register again.");
      return;
    }
    setResendLoading(true);
    try {
      await authApi.resendVerification(resolvedEmail);
      Alert.alert("Email Sent", "Verification email sent! Check your inbox.");
      setResendCooldown(60);
    } catch (e: any) {
      const msg = e?.message || "Failed to resend verification email";
      if (msg.toLowerCase().includes("already verified")) {
        Alert.alert("Already Verified", "Your email is already verified. Please login.");
        router.replace("/login");
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <View style={[styles.icon, { backgroundColor: "#7c3aed22", borderColor: Colors.primary }]}>
          <Feather name="mail" size={40} color={Colors.primary} />
        </View>
      </View>

      {/* Heading */}
      <Text style={styles.heading}>Check Your Email</Text>
      <Text style={styles.message}>
        We sent a verification link to{"\n"}
        <Text style={styles.emailHighlight}>{resolvedEmail || "your email address"}</Text>
        {"\n\n"}Click the link in your email to activate your account. The link expires in 24 hours.
      </Text>

      {/* Resend button */}
      <Pressable
        style={[styles.primaryBtn, (resendCooldown > 0 || resendLoading) && styles.disabledBtn]}
        onPress={handleResendEmail}
        disabled={resendCooldown > 0 || resendLoading}
      >
        {resendLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Email"}
          </Text>
        )}
      </Pressable>

      {/* Back to login */}
      <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/login")}>
        <Text style={styles.secondaryBtnText}>← Back to Login</Text>
      </Pressable>

      {/* Register again */}
      <Pressable style={styles.tertiaryBtn} onPress={() => router.replace("/register")}>
        <Text style={styles.tertiaryBtnText}>Wrong email? Register again</Text>
      </Pressable>

      <Text style={styles.hint}>
        Didn't receive it? Check your spam folder or use the resend button above.
      </Text>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 28, flexGrow: 1, alignItems: "center" },
  iconContainer: { alignItems: "center", marginBottom: 32 },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 36,
  },
  emailHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 12,
  },
  primaryBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  disabledBtn: { opacity: 0.5 },
  secondaryBtn: {
    width: "100%",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  tertiaryBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 24,
  },
  tertiaryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    opacity: 0.7,
  },
});
