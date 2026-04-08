import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120000,
      gcTime: 600000,
      refetchOnWindowFocus: false,
    },
  },
});

const PROTECTED_SEGMENT = "(tabs)";
const AUTH_SCREENS = ["onboarding", "login", "register", "verify-email"];

function AuthGuard() {
  const { user, isLoading, isEmailVerified } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const segment = segments[0] as string | undefined;
    const inProtected = segment === PROTECTED_SEGMENT;
    const inAuthScreen = !segment || AUTH_SCREENS.includes(segment);

    if (!user && inProtected) {
      router.replace("/onboarding");
    } else if (user && inAuthScreen) {
      if (isEmailVerified) {
        router.replace("/(tabs)");
      }
    } else if (user && inProtected && !isEmailVerified) {
      router.replace("/verify-email");
    }
  }, [user, segments, isLoading, isEmailVerified]);

  return null;
}

function CacheClearer() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const currentId = user?.id ?? null;
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = currentId;
      return;
    }
    if (prevUserIdRef.current !== currentId) {
      queryClient.clear();
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  return null;
}

const SCREEN_TRANSITION = {
  animation: "slide_from_right" as const,
  animationDuration: 280,
  gestureEnabled: true,
};

const MODAL_TRANSITION = {
  animation: "slide_from_bottom" as const,
  animationDuration: 320,
  gestureEnabled: true,
};

function RootLayoutNav() {
  return (
    <>
      <AuthGuard />
      <CacheClearer />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          ...SCREEN_TRANSITION,
        }}
      >
        <Stack.Screen name="index"           options={{ animation: "fade", animationDuration: 200 }} />
        <Stack.Screen name="onboarding"      options={{ animation: "fade", animationDuration: 300 }} />
        <Stack.Screen name="login"           options={SCREEN_TRANSITION} />
        <Stack.Screen name="register"        options={SCREEN_TRANSITION} />
        <Stack.Screen name="forgot-password" options={SCREEN_TRANSITION} />
        <Stack.Screen name="reset-password"  options={SCREEN_TRANSITION} />
        <Stack.Screen name="verify-email"    options={{ ...SCREEN_TRANSITION, headerShown: false }} />
        <Stack.Screen name="(tabs)"          options={{ animation: "fade", animationDuration: 250 }} />
        <Stack.Screen name="add-transaction" options={{ ...MODAL_TRANSITION, presentation: "modal" }} />
        <Stack.Screen name="receipt-scanner" options={{ ...MODAL_TRANSITION, presentation: "modal" }} />
        <Stack.Screen name="sms-scanner"     options={{ ...MODAL_TRANSITION, presentation: "modal" }} />
        <Stack.Screen name="categories"      options={SCREEN_TRANSITION} />
        <Stack.Screen name="budgets"         options={SCREEN_TRANSITION} />
        <Stack.Screen name="help"            options={SCREEN_TRANSITION} />
        <Stack.Screen name="privacy"         options={SCREEN_TRANSITION} />
        <Stack.Screen name="about"           options={SCREEN_TRANSITION} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const isWeb = Platform.OS === "web";

  return (
    <SafeAreaProvider
      style={isWeb ? { flex: 1, backgroundColor: "#0f0f1a" } : { flex: 1 }}
    >
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView
              style={
                isWeb
                  ? {
                      flex: 1,
                      maxWidth: 430,
                      width: "100%",
                      alignSelf: "center",
                      overflow: "hidden",
                      boxShadow: "0 0 60px rgba(0,0,0,0.6)",
                    } as any
                  : { flex: 1 }
              }
            >
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
