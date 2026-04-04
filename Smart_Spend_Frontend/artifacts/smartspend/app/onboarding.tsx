import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { Colors } from "@/constants/colors";

const { width } = Dimensions.get("window");

const FEATURES = [
  { icon: "trending-up",  label: "Track expenses automatically",   color: "#00C897", bg: "rgba(0,200,151,0.25)"  },
  { icon: "cpu",          label: "AI-powered spending insights",    color: "#FD79A8", bg: "rgba(253,121,168,0.25)" },
  { icon: "pie-chart",    label: "Budget goals & smart alerts",     color: "#FDCB6E", bg: "rgba(253,203,110,0.25)" },
  { icon: "camera",       label: "Scan receipts instantly",         color: "#74B9FF", bg: "rgba(116,185,255,0.25)" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();

  // Animations — start visible, animate position/scale only
  const logoScale  = useRef(new Animated.Value(0.82)).current;
  const logoSlide  = useRef(new Animated.Value(-18)).current;
  const btnSlide   = useRef(new Animated.Value(24)).current;
  const featureAnims = useRef(FEATURES.map(() => new Animated.Value(-32))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: false }),
        Animated.timing(logoSlide, { toValue: 0, duration: 420, useNativeDriver: false }),
      ]),
      Animated.stagger(90, featureAnims.map((a) =>
        Animated.spring(a, { toValue: 0, friction: 7, tension: 48, useNativeDriver: false })
      )),
      Animated.timing(btnSlide, { toValue: 0, duration: 300, useNativeDriver: false }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#5248E8", "#3D36C0", "#1E1A8A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      {/* Decorative circles */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <View style={[styles.content, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>

        {/* ── Logo ── */}
        <Animated.View
          style={[
            styles.logoContainer,
            { transform: [{ scale: logoScale }, { translateY: logoSlide }] },
          ]}
        >
          <View style={styles.logoIconBg}>
            <Feather name="credit-card" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.logoText}>SmartSpend</Text>
          <Text style={styles.tagline}>Your money, fully automated</Text>
        </Animated.View>

        {/* ── Feature rows ── */}
        <View style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.label}
              style={{ transform: [{ translateX: featureAnims[i] }] }}
            >
              <FeatureRow icon={f.icon} label={f.label} color={f.color} bg={f.bg} />
            </Animated.View>
          ))}
        </View>
      </View>

      {/* ── Bottom buttons ── */}
      <Animated.View
        style={[
          styles.bottomSection,
          {
            paddingBottom: insets.bottom + 32,
            transform: [{ translateY: btnSlide }],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.getStartedBtn, { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={() => router.push("/register")}
        >
          <Text style={styles.getStartedText}>Get Started  →</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/login")}>
          <Text style={styles.loginLink}>
            Already have an account?{"  "}
            <Text style={styles.loginLinkBold}>Log In</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function FeatureRow({ icon, label, color, bg }: { icon: string; label: string; color: string; bg: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: bg, borderColor: color + "50", borderWidth: 1.5 }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 32 },

  circle1: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(255,255,255,0.06)", top: -90, right: -90 },
  circle2: { position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.04)", bottom: 180, left: -70 },
  circle3: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.07)", top: 200, left: 20 },

  logoContainer: { alignItems: "center", marginTop: 56 },
  logoIconBg: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.97)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  logoText: { fontFamily: "Inter_700Bold", fontSize: 36, color: "#fff", letterSpacing: -1 },
  tagline:  { fontFamily: "Inter_400Regular", fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 8 },

  features: { marginTop: 52, width: "100%", gap: 18 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  featureLabel: { fontFamily: "Inter_500Medium", fontSize: 15, color: "#fff", flex: 1 },

  bottomSection: { paddingHorizontal: 32, alignItems: "center", gap: 18 },
  getStartedBtn: {
    width: "100%",
    backgroundColor: "#fff",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  getStartedText: { fontFamily: "Inter_700Bold", fontSize: 17, color: Colors.primary },
  loginLink:     { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.6)" },
  loginLinkBold: { fontFamily: "Inter_700Bold", color: "#fff" },
});
