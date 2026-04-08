import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
  Animated,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/services/api";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 960;
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleResendVerification = async (emailAddr: string) => {
    try {
      await authApi.resendVerification(emailAddr);
      Alert.alert("Email Sent", "Verification email sent! Check your inbox.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to resend verification email.");
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError(null);
    if (!email || !password) {
      setError("Please fill in your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg: string = e?.message || "Invalid credentials";
      const isNotVerified = msg.toLowerCase().includes("verify");

      if (isNotVerified) {
        setError("Your email isn't verified yet. Use the button below to resend the verification email.");
      } else {
        setError(msg || "Incorrect email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[
          styles.content,
          isWide && styles.wideContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding")}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </Pressable>

        <Text style={styles.heading}>Welcome Back! 👋</Text>
        <Text style={styles.subtitle}>Sign in to continue to SmartSpend</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Icon name="mail" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Icon name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Icon name={showPass ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Pressable style={styles.forgotBtn} onPress={() => router.push("/forgot-password")}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#D32F2F" style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {error?.includes("verified") ? (
            <View style={styles.verifyRow}>
              <Pressable
                style={styles.resendBtn}
                onPress={() => handleResendVerification(email.trim().toLowerCase())}
              >
                <Text style={styles.resendBtnText}>Resend Verification Email</Text>
              </Pressable>
              <Pressable
                style={styles.checkEmailBtn}
                onPress={() => router.push({ pathname: "/verify-email", params: { email: email.trim().toLowerCase() } })}
              >
                <Text style={styles.checkEmailBtnText}>Check Email Screen</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.loginBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Log In</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>Don't have an account? </Text>
          <Pressable onPress={() => router.replace("/register")}>
            <Text style={styles.registerLink}>Sign Up</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  wideContent: { maxWidth: 480, alignSelf: "center", width: "100%" },
  backBtn: { marginBottom: 32 },
  heading: { fontFamily: "Inter_700Bold", fontSize: 28, color: Colors.text, marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: Colors.textSecondary, marginBottom: 36 },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
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
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: "flex-end", marginTop: 4 },
  forgotText: { fontFamily: "Inter_500Medium", fontSize: 13, color: Colors.primary },
  loginBtn: {
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
  loginBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  registerRow: { flexDirection: "row", justifyContent: "center", marginTop: 36 },
  registerPrompt: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },
  registerLink: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFEBEE",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#C62828",
    flex: 1,
    lineHeight: 18,
  },
  verifyRow: { gap: 10 },
  resendBtn: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    paddingVertical: 12,
    alignItems: "center",
  },
  resendBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#E65100" },
  checkEmailBtn: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  checkEmailBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },
});
