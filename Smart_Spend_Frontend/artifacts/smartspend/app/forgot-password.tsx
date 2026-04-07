import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: false }),
    ]).start();
  }, []);

  const handleForgotPassword = async () => {
    Keyboard.dismiss();
    if (!email) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSuccess(true);
      Alert.alert(
        "Reset Link Sent",
        res.message || "Password reset link sent to your email"
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Animated.ScrollView
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
      <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/login")}>
        <Icon name="arrow-left" size={24} color={Colors.text} />
      </Pressable>

      <View style={styles.iconContainer}>
        <View style={styles.icon}>
          <Icon name="lock" size={48} color={Colors.primary} />
        </View>
      </View>

      <Text style={styles.heading}>Forgot Password?</Text>
      <Text style={styles.subtitle}>
        Enter your email address and we'll send you a link to reset your password.
      </Text>

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

        <Pressable
          style={({ pressed }) => [styles.submitBtn, { opacity: pressed || loading ? 0.85 : 1 }]}
          onPress={handleForgotPassword}
          disabled={loading || success}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {success ? "Link Sent" : "Send Reset Link"}
            </Text>
          )}
        </Pressable>

        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>
              A reset link has been sent to your email.{"\n"}
              Open the link on this device to reset your password,{"\n"}
              or enter your reset token manually if prompted.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.tokenLinkBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.push("/reset-password")}
            >
              <Text style={styles.tokenLinkBtnText}>I have a reset token →</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.loginRow}>
        <Text style={styles.loginPrompt}>Remember your password? </Text>
        <Pressable onPress={() => router.replace("/login")}>
          <Text style={styles.loginLink}>Sign In</Text>
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
  iconContainer: { alignItems: "center", marginBottom: 32 },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 36,
  },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
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
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
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
    marginTop: 8,
  },
  submitBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  successText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.success,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
  },
  successContainer: {
    alignItems: "center",
  },
  tokenLinkBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  tokenLinkBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 36,
  },
  loginPrompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
});
