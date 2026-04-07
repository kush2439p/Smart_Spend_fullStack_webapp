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
  register: (name: string, email: string, password: string) => Promise<{ email: string }>;
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
      const [storedToken, storedUser] = await AsyncStorage.multiGet(["auth_token", "auth_user"]);
      const token = storedToken[1];
      const userJson = storedUser[1];

      if (!token) {
        // No token stored — start fresh at login
        setToken(null);
        setUser(null);
        setIsEmailVerified(false);
        setIsLoading(false);
        return;
      }

      // Optimistic restore: show the app immediately using cached user
      if (userJson) {
        const cachedUser: User = JSON.parse(userJson);
        setToken(token);
        setUser(cachedUser);
        setIsEmailVerified(cachedUser.emailVerified || false);
        setIsLoading(false);
      }

      // Validate token with server in the background
      try {
        const freshUser = await authApi.me();
        await AsyncStorage.setItem("auth_user", JSON.stringify(freshUser));
        setToken(token);
        setUser(freshUser);
        setIsEmailVerified(freshUser.emailVerified || false);
      } catch (validationError) {
        // Token is invalid or expired — clear session and redirect to login
        console.log("Background token validation failed, clearing auth:", validationError);
        await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
        setToken(null);
        setUser(null);
        setIsEmailVerified(false);
        // If not already loading (optimistic restore happened), navigate away
        if (userJson) {
          router.replace("/onboarding");
        }
      }

      // If there was no cached user, we waited for the server — finish loading now
      if (!userJson) {
        setIsLoading(false);
      }
    } catch (error) {
      console.log("Failed to read stored auth:", error);
      await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
      setToken(null);
      setUser(null);
      setIsEmailVerified(false);
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    await AsyncStorage.setItem("auth_token", res.token);
    await AsyncStorage.setItem("auth_user", JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    setIsEmailVerified(res.user.emailVerified || false);
    // Navigation handled by AuthGuard in _layout.tsx
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register(name, email, password);
    // Store pending email so verify-email screen can use it for resend
    await AsyncStorage.setItem("pending_verify_email", email);
    // Do NOT log user in — they must verify email first
    router.replace({ pathname: "/verify-email", params: { email } });
    return { email };
  };

  const verifyEmail = async (token: string) => {
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
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    await AsyncStorage.multiRemove(["auth_token", "auth_user", "pending_verify_email"]);
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
