import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import Icon from "@/components/Icon";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  if (!isLoading && !user) {
    return <Redirect href="/onboarding" />;
  }

  const tabBg = isDark ? "#1C1B2E" : "#FFFFFF";
  const borderColor = isDark ? "#2D2B45" : "#EBEBF5";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: isDark ? "#6B7280" : "#9CA3AF",
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          marginTop: 1,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: tabBg,
          borderTopWidth: 1,
          borderTopColor: borderColor,
          elevation: 20,
          shadowColor: "#6C63FF",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
          ...(Platform.OS === "web" ? { height: 84, paddingBottom: 34 } : {}),
          ...(Platform.OS === "android" ? { paddingBottom: 8, height: 64 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderTopWidth: 0.5, borderTopColor: borderColor }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: tabBg, borderTopWidth: 1, borderTopColor: borderColor }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name="home" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name="list" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "AI Chat",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.aiTabIcon, focused && styles.aiTabIconActive]}>
              <Icon name="zap" size={19} color={focused ? "#fff" : Colors.primary} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name="bar-chart-2" size={20} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name="settings" size={19} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Icon name="user" size={20} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: Colors.primary + "18",
  },
  aiTabIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -10,
    borderWidth: 2,
    borderColor: Colors.primary + "30",
  },
  aiTabIconActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
});
