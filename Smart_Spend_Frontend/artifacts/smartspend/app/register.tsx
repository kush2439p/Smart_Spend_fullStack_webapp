import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
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

  const handleRegister = async () => {
    Keyboard.dismiss();
    setError(null);

    if (!name.trim() || !email.trim() || !password || !confirmPass) {
      setError("Please fill in all fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg = e?.message || "Something went wrong. Please try again.";
      setError(msg);
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
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding")}>
          <Icon name="arrow-left" size={24} color={Colors.text} />
        </Pressable>

        <Text style={styles.heading}>Create Account</Text>
        <Text style={styles.subtitle}>Start your financial journey today</Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Icon name="user" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={Colors.textSecondary}
                value={name}
                onChangeText={(t) => { setName(t); setError(null); }}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Icon name="mail" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="john@example.com"
                placeholderTextColor={Colors.textSecondary}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(null); }}
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
                placeholder="Min. 6 characters"
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={(t) => { setPassword(t); setError(null); }}
                secureTextEntry={!showPass}
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Icon name={showPass ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Icon name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Repeat your password"
                placeholderTextColor={Colors.textSecondary}
                value={confirmPass}
                onChangeText={(t) => { setConfirmPass(t); setError(null); }}
                secureTextEntry={!showConfirmPass}
              />
              <Pressable onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeBtn}>
                <Icon name={showConfirmPass ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#D32F2F" style={{ marginRight: 8, flexShrink: 0 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {error?.toLowerCase().includes("already registered") ? (
            <Pressable style={styles.loginHintBtn} onPress={() => router.replace("/login")}>
              <Text style={styles.loginHintText}>Go to Login instead →</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.registerBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerBtnText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already have an account? </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.loginLink}>Log In</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, flexGrow: 1 },
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
  loginHintBtn: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: -8,
  },
  loginHintText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: Colors.primary },
  registerBtn: {
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
  registerBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 36 },
  loginPrompt: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.textSecondary },
  loginLink: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: Colors.primary },
});
