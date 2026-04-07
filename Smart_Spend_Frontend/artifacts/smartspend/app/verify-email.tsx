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
import Icon from "@/components/Icon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";

export default function VerifyEmailScreen() {
  const insets = useSafeAreaInsets();
  const { token: urlToken, email: paramEmail } = useLocalSearchParams();

  // "checking" = token present and verifying
  // "success"  = verified via token
  // "failed"   = token invalid/expired
  // "pending"  = no token, waiting for user to click email link
  type ScreenState = "checking" | "success" | "failed" | "pending";

  const [state, setState] = useState<ScreenState>(urlToken ? "checking" : "pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState<string>("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSent, setResendSent] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Fade in
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  // Resolve user email for resend (from nav param or AsyncStorage)
  useEffect(() => {
    const load = async () => {
      if (typeof paramEmail === "string" && paramEmail) {
        setResolvedEmail(paramEmail);
      } else {
        const stored = await AsyncStorage.getItem("pending_verify_email");
        if (stored) setResolvedEmail(stored);
      }
    };
    load();
  }, [paramEmail]);

  // If token present in URL → call backend to verify
  useEffect(() => {
    if (!urlToken) return;
    const token = Array.isArray(urlToken) ? urlToken[0] : urlToken;
    setState("checking");
    authApi.verifyEmail(token)
      .then(async () => {
        // Clear pending email from storage
        await AsyncStorage.removeItem("pending_verify_email");
        setState("success");
      })
      .catch((e: any) => {
        const msg: string = e?.message || "Verification failed.";
        setErrorMsg(msg.includes("EXPIRED:") ? msg.replace("EXPIRED:", "") : msg);
        setState("failed");
      });
  }, [urlToken]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!resolvedEmail) {
      Alert.alert("Error", "Email address not found. Please go back and register again.");
      return;
    }
    setResendLoading(true);
    try {
      await authApi.resendVerification(resolvedEmail);
      setResendSent(true);
      setResendCooldown(60);
    } catch (e: any) {
      const msg = e?.message || "Failed to resend verification email";
      if (msg.toLowerCase().includes("already verified")) {
        Alert.alert("Already Verified", "Your account is already verified. Please login.");
        router.replace("/login");
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setResendLoading(false);
    }
  };

  // ── CHECKING state ──────────────────────────────────────────
  if (state === "checking") {
    return (
      <Animated.View style={[styles.container, styles.centered, { opacity: fadeAnim }]}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
        <Text style={styles.heading}>Verifying your email…</Text>
        <Text style={styles.subtitle}>Please wait a moment.</Text>
      </Animated.View>
    );
  }

  // ── SUCCESS state ──────────────────────────────────────────
  if (state === "success") {
    return (
      <Animated.View style={[styles.container, styles.centered, { opacity: fadeAnim, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}>
        <View style={[styles.iconCircle, { borderColor: Colors.success, backgroundColor: Colors.success + "22" }]}>
          <Icon name="check-circle" size={48} color={Colors.success} />
        </View>
        <Text style={styles.heading}>Email Verified!</Text>
        <Text style={styles.subtitle}>Your account is now active. You can log in and start using SmartSpend.</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: Colors.success }]} onPress={() => router.replace("/login")}>
          <Text style={styles.primaryBtnText}>Go to Login</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ── FAILED state ──────────────────────────────────────────
  if (state === "failed") {
    return (
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim }]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
      >
        <View style={[styles.iconCircle, { borderColor: Colors.error, backgroundColor: Colors.error + "22" }]}>
          <Icon name="alert-circle" size={48} color={Colors.error} />
        </View>
        <Text style={styles.heading}>Link Expired or Invalid</Text>
        <Text style={styles.subtitle}>
          {errorMsg || "This verification link is no longer valid. Request a new one below."}
        </Text>

        {resolvedEmail ? (
          <Pressable
            style={[styles.primaryBtn, (resendCooldown > 0 || resendLoading) && styles.disabledBtn]}
            onPress={handleResend}
            disabled={resendCooldown > 0 || resendLoading}
          >
            {resendLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Send New Verification Email"}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/register")}>
            <Text style={styles.primaryBtnText}>Register Again</Text>
          </Pressable>
        )}

        {resendSent && (
          <Text style={styles.successNote}>New verification email sent! Check your inbox.</Text>
        )}

        <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/login")}>
          <Text style={styles.secondaryBtnText}>← Back to Login</Text>
        </Pressable>
      </Animated.ScrollView>
    );
  }

  // ── PENDING state (just registered, waiting for email click) ──
  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
    >
      <View style={[styles.iconCircle, { borderColor: Colors.primary, backgroundColor: Colors.primary + "15" }]}>
        <Icon name="mail" size={48} color={Colors.primary} />
      </View>

      <Text style={styles.heading}>Check Your Email</Text>
      <Text style={styles.subtitle}>
        We sent a verification link to{"\n"}
        <Text style={styles.emailText}>{resolvedEmail || "your email address"}</Text>
        {"\n\n"}Click the link to activate your account. It expires in 24 hours.
      </Text>

      {resendSent ? (
        <View style={styles.successBanner}>
          <Icon name="check-circle" size={18} color={Colors.success} style={{ marginRight: 8 }} />
          <Text style={styles.successBannerText}>Email sent! Check your inbox.</Text>
        </View>
      ) : (
        <Text style={styles.hintText}>Didn't receive it? Check your spam folder, then use the button below.</Text>
      )}

      <Pressable
        style={[styles.primaryBtn, (resendCooldown > 0 || resendLoading) && styles.disabledBtn]}
        onPress={handleResend}
        disabled={resendCooldown > 0 || resendLoading}
      >
        {resendLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Verification Email"}
          </Text>
        )}
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/login")}>
        <Text style={styles.secondaryBtnText}>← Back to Login</Text>
      </Pressable>

      <Pressable style={styles.tertiaryBtn} onPress={() => router.replace("/register")}>
        <Text style={styles.tertiaryBtnText}>Wrong email? Register again</Text>
      </Pressable>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  content: { paddingHorizontal: 28, alignItems: "center", flexGrow: 1 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 28,
  },
  emailText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.primary,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  successNote: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.success,
    textAlign: "center",
    marginTop: 12,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.success + "15",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    width: "100%",
  },
  successBannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.success,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 12,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
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
  secondaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text },
  tertiaryBtn: { paddingVertical: 8, alignItems: "center" },
  tertiaryBtnText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
});
