import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";
import { authApi } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

export default function EmailVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams();
  const { user } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    
    if (token) {
      setVerifying(true);
      const verifyEmailToken = async () => {
        try {
          const res = await authApi.verifyEmail(token as string);
          setSuccess(true);
          setMessage(res.message || "Email verified successfully! You can now login.");
        } catch (e: any) {
          setSuccess(false);
          setMessage(e.message || "Verification failed. The link may have expired.");
        } finally {
          setVerifying(false);
        }
      };

      verifyEmailToken();
    } else {
      // No token provided - show check email message (user came from registration)
      setVerifying(false);
      setSuccess(false);
      setMessage("Please check your email and click the verification link to activate your account.");
    }
  }, [token]); // Remove verifyEmail from dependencies to prevent infinite loops

  // Resend email cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (!user?.email) return;
    
    setResendLoading(true);
    try {
      await authApi.resendVerification(user.email);
      Alert.alert("Success", "Verification email sent! Check your inbox.");
      setResendCooldown(60); // Start 60 second cooldown
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  }; // Remove verifyEmail from dependencies to prevent infinite loops

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {verifying ? (
            <ActivityIndicator size={48} color={Colors.primary} />
          ) : success ? (
            <View style={[styles.icon, { backgroundColor: Colors.success }]}>
              <Feather name="check" size={32} color="#fff" />
            </View>
          ) : (
            <View style={[styles.icon, { backgroundColor: Colors.warning }]}>
              <Feather name="mail" size={32} color="#fff" />
            </View>
          )}
        </View>

        <Text style={styles.heading}>
          {verifying ? "Verifying Email..." : success ? "Email Verified!" : "Check Your Email"}
        </Text>

        <Text style={styles.message}>{message}</Text>

        {success && (
          <Pressable
            style={styles.loginBtn}
            onPress={() => {
              console.log("Verify Email: Go to Login pressed");
              router.replace("/login");
            }}
          >
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </Pressable>
        )}

        {!success && !verifying && (
          <View>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                console.log("Verify Email: Back to Login pressed");
                router.replace("/login");
              }}
            >
              <Text style={styles.retryBtnText}>← Back to Login</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => {
                console.log("Verify Email: Register New Email pressed");
                router.replace("/register");
              }}
            >
              <Text style={styles.secondaryBtnText}>📧 Register New Email</Text>
            </Pressable>
            {user?.email && (
              <Pressable
                style={[
                  styles.tertiaryBtn,
                  resendCooldown > 0 && styles.disabledBtn
                ]}
                onPress={handleResendEmail}
                disabled={resendCooldown > 0 || resendLoading}
              >
                {resendLoading ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <Text style={styles.tertiaryBtnText}>
                    {resendCooldown > 0 
                      ? `📧 Resend in ${resendCooldown}s` 
                      : "📧 Resend Email"
                    }
                  </Text>
                )}
              </Pressable>
            )}
            <Text style={styles.resendText}>
              Didn't receive email? Check your spam folder or try registering again.
            </Text>
          </View>
        )}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  iconContainer: { alignItems: "center", marginBottom: 32 },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
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
    lineHeight: 24,
    marginBottom: 32,
  },
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
    marginTop: 16,
  },
  loginBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#fff",
  },
  retryBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  retryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  secondaryBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  secondaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.primary,
  },
  tertiaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  tertiaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  resendText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
  },
});
