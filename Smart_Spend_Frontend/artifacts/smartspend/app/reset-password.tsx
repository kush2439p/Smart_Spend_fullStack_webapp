import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { token: urlToken } = useLocalSearchParams();
  const [token, setToken] = useState(typeof urlToken === "string" ? urlToken : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setErrorMsg("");
    if (!token.trim()) {
      setErrorMsg("Please enter your reset token");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter a new password");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      setSuccess(true);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to reset password. The token may have expired.");
    } finally {
      setLoading(false);
    }
  };

  // ── SUCCESS STATE ──────────────────────────────────────────
  if (success) {
    return (
      <Animated.View style={[styles.container, styles.centered, { opacity: fadeAnim, paddingHorizontal: 28 }]}>
        <View style={[styles.iconCircle, { borderColor: Colors.success, backgroundColor: Colors.success + "20" }]}>
          <Icon name="check-circle" size={48} color={Colors.success} />
        </View>
        <Text style={styles.heading}>Password Reset!</Text>
        <Text style={styles.subtitle}>
          Your password has been changed successfully. You can now log in with your new password.
        </Text>
        <Pressable style={[styles.submitBtn, { backgroundColor: Colors.success }]} onPress={() => router.replace("/login")}>
          <Text style={styles.submitBtnText}>Go to Login</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // ── FORM STATE ──────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/login")}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Icon name="unlock" size={40} color={Colors.primary} />
          </View>
        </View>

        <Text style={styles.heading}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter the reset token from your email and choose a new password.</Text>

        <View style={styles.form}>
          {/* Error banner */}
          {!!errorMsg && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={16} color={Colors.error} style={{ marginRight: 8 }} />
              <Text style={styles.errorBannerText}>{errorMsg}</Text>
            </View>
          )}

          {/* Reset Token */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Reset Token</Text>
            <View style={styles.inputWrapper}>
              <Icon name="key" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Paste your reset token here"
                placeholderTextColor={Colors.textSecondary}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.helperText}>Copy the token from the reset email and paste it above</Text>
          </View>

          {/* New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Icon name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Min. 6 characters"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Icon name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Repeat new password"
                placeholderTextColor={Colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable style={styles.eyeIcon} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Icon name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Reset Password</Text>
            )}
          </Pressable>

          <Pressable style={styles.backToForgotBtn} onPress={() => router.replace("/forgot-password")}>
            <Text style={styles.backToForgotText}>Need a new reset link?</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  backBtn: { marginBottom: 24 },
  iconContainer: { alignItems: "center", marginBottom: 24 },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  form: { gap: 20 },
  fieldGroup: { gap: 6 },
  label: { fontFamily: "Inter_500Medium", fontSize: 14, color: Colors.text },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.text },
  eyeIcon: { padding: 4, marginLeft: 8 },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.error + "18",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorBannerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 4,
  },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  backToForgotBtn: { alignItems: "center", paddingVertical: 8 },
  backToForgotText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.textSecondary,
    textDecorationLine: "underline",
  },
});
