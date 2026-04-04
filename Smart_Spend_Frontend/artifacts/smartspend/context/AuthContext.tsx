import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Alert } from "react-native";
import { authApi, User } from "@/services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsEmailVerified(parsedUser.emailVerified || false);
      } else {
        // No stored auth - clear everything
        setToken(null);
        setUser(null);
        setIsEmailVerified(false);
      }
    } catch (error) {
      console.error("Failed to load stored auth:", error);
      setToken(null);
      setUser(null);
      setIsEmailVerified(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await authApi.login(email, password);
      await AsyncStorage.setItem("auth_token", res.token);
      await AsyncStorage.setItem("auth_user", JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      setIsEmailVerified(res.user.emailVerified || false);
      // Navigation handled by AuthGuard in _layout.tsx
    } catch (e: any) {
      // Handle JSON parse errors and other network issues
      let errorMessage = "Invalid credentials";
      if (e.message && e.message.includes("JSON")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (e.message) {
        errorMessage = e.message;
      }
      Alert.alert("Login Failed", errorMessage);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await authApi.register(name, email, password);
      // Don't save token/user immediately - redirect to email verification page
      router.replace("/verify-email");
      Alert.alert(
        "Registration Successful!", 
        "Please check your email and click the verification link to activate your account."
      );
    } catch (e: any) {
      // Handle JSON parse errors and other network issues
      let errorMessage = "Something went wrong";
      if (e.message && e.message.includes("JSON")) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (e.message) {
        errorMessage = e.message;
      }
      Alert.alert("Registration Failed", errorMessage);
    }
  };

  const verifyEmail = async (token: string) => {
    try {
      const res = await authApi.verifyEmail(token);
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        const updated = { ...parsedUser, emailVerified: true };
        setUser(updated);
        AsyncStorage.setItem("auth_user", JSON.stringify(updated));
        setIsEmailVerified(true);
      }
      return res;
    } catch (e: any) {
      throw new Error(e.message || "Verification failed");
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
    setToken(null);
    setUser(null);
    setIsEmailVerified(false);
    router.replace("/onboarding");
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates };
      setUser(updated);
      AsyncStorage.setItem("auth_user", JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isEmailVerified, login, register, verifyEmail, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
