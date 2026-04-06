import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  if (!isLoading && !user) {
    return <Redirect href="/onboarding" />;
  }

  const tabBg = isDark ? "#1C1B2E" : "#FFFFFF";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDark ? "#888" : "#6B7280",
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10, marginTop: -2 },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: tabBg,
          borderTopWidth: 1,
          borderTopColor: isDark ? "#2D2B45" : "#E5E7EB",
          elevation: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          ...(isWeb ? { height: 84, paddingBottom: 34 } : {}),
          ...(Platform.OS === "android" ? { paddingBottom: 8, height: 64 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderTopWidth: 0.5, borderTopColor: isDark ? "#333" : "#E5E7EB" }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tabBg, borderTopWidth: 1, borderTopColor: isDark ? "#2D2B45" : "#E5E7EB" }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI Chat",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.aiTabIcon, focused && styles.aiTabIconActive]}>
              <Ionicons name="sparkles" size={20} color={focused ? "#fff" : color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  aiTabIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E8E7FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
  },
  aiTabIconActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
