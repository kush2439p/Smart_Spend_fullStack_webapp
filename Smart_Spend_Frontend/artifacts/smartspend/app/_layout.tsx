import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, useSegments } from "expo-router";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
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
    
    console.log("AuthGuard Debug:", { 
      segment, 
      inProtected, 
      inAuthScreen, 
      hasUser: !!user, 
      isEmailVerified,
      userEmail: user?.email 
    });
    
    if (!user && inProtected) {
      console.log("AuthGuard: Redirecting to onboarding (no user)");
      router.replace("/onboarding");
    } else if (user && inAuthScreen) {
      // Only redirect to dashboard if email is verified
      if (isEmailVerified) {
        console.log("AuthGuard: Redirecting to tabs (user verified)");
        router.replace("/(tabs)");
      } else {
        console.log("AuthGuard: User not verified, staying on current auth screen");
        // Don't force redirect - let user stay on auth screens
      }
    } else if (user && inProtected && !isEmailVerified) {
      console.log("AuthGuard: Redirecting to verify-email (user not verified)");
      router.replace("/verify-email");
    }
  }, [user, segments, isLoading, isEmailVerified]);

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
        <Stack.Screen name="verify-email"     options={{ ...SCREEN_TRANSITION, headerShown: false }} />
        <Stack.Screen name="(tabs)"          options={{ animation: "fade", animationDuration: 250 }} />
        <Stack.Screen name="add-transaction" options={{ ...MODAL_TRANSITION, presentation: "modal" }} />
        <Stack.Screen name="receipt-scanner" options={{ ...MODAL_TRANSITION, presentation: "modal" }} />
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
  useEffect(() => {
    // Load fonts in background — silently swallow any CDN timeout errors
    Font.loadAsync({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    }).catch(() => {});
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
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
