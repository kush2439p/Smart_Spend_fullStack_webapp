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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { token: urlToken } = useLocalSearchParams();
  const [token, setToken] = useState(typeof urlToken === 'string' ? urlToken : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    
    if (!token.trim()) {
      Alert.alert("Error", "Please enter your reset token");
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword(token as string, password);
      Alert.alert(
        "Success",
        "Password reset successfully! Please login with your new password.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/login")
          }
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
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
          <Pressable style={styles.backBtn} onPress={() => router.replace("/login")}>
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </Pressable>

          <View style={styles.iconContainer}>
            <View style={styles.icon}>
              <Feather name="alert-circle" size={48} color={Colors.error} />
            </View>
          </View>

          <Text style={styles.heading}>Invalid Reset Link</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired.
          </Text>

          <View style={styles.form}>
            <Pressable
              style={({ pressed }) => [styles.submitBtn, { opacity: pressed ? 0.85 : 1 }]}
              onPress={() => router.replace("/forgot-password")}
            >
              <Text style={styles.submitBtnText}>Request New Reset Link</Text>
            </Pressable>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
        <Pressable style={styles.backBtn} onPress={() => router.replace("/login")}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>

        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Feather name="unlock" size={48} color={Colors.primary} />
          </View>
        </View>

        <Text style={styles.heading}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter your reset token and new password below.
        </Text>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Reset Token</Text>
            <View style={styles.inputWrapper}>
              <Feather name="key" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor={Colors.textSecondary}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.helperText}>
            <Text style={styles.helperText}>
              Check your email for reset token.{"\n"}
              Copy the token from the email and paste it above.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor={Colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={18} 
                  color={Colors.textSecondary} 
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <Pressable
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Feather 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={18} 
                  color={Colors.textSecondary} 
                />
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
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
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
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
});
