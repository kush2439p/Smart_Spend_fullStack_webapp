import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
  const [loading, setLoading] = useState(false);
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
  if (!name || !email || !password || !confirmPass) {
    Alert.alert("Error", "Please fill in all fields");
    return;
  }
  if (password !== confirmPass) {
    Alert.alert("Error", "Passwords do not match");
    return;
  }
  if (password.length < 6) {
    Alert.alert("Error", "Password must be at least 6 characters");
    return;
  }
  setLoading(true);
  try {
    await register(name, email, password);
  } catch (e: any) {
    Alert.alert("Registration Failed", e.message || "Something went wrong");
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
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
            paddingBottom: insets.bottom + 40,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
      <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding")}>
        <Feather name="arrow-left" size={24} color={Colors.text} />
      </Pressable>

      <Text style={styles.heading}>Create Account</Text>
      <Text style={styles.subtitle}>Start your financial journey today</Text>

      <View style={styles.form}>
        {[
          { label: "Full Name", icon: "user", value: name, setter: setName, placeholder: "John Doe", type: "default" as const },
          { label: "Email Address", icon: "mail", value: email, setter: setEmail, placeholder: "john@example.com", type: "email-address" as const },
        ].map((field) => (
          <View style={styles.fieldGroup} key={field.label}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.inputWrapper}>
              <Feather name={field.icon as any} size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={Colors.textSecondary}
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.type}
                autoCapitalize={field.type === "email-address" ? "none" : "words"}
                autoCorrect={false}
              />
            </View>
          </View>
        ))}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={Colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Repeat your password"
              placeholderTextColor={Colors.textSecondary}
              value={confirmPass}
              onChangeText={setConfirmPass}
              secureTextEntry={!showPass}
            />
          </View>
        </View>

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
