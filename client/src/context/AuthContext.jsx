import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const signup = async (payload) => {
    const me = await api.post("/auth/signup", payload);
    setUser(me);
  };

  const login = async (payload) => {
    const me = await api.post("/auth/login", payload);
    setUser(me);
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setUser(null);
  };

  const updateCategories = async (categories) => {
    // Optimistic: show the new category list immediately, roll back on failure.
    const prev = user?.categories;
    setUser((u) => (u ? { ...u, categories } : u));
    try {
      const res = await api.patch("/auth/categories", { categories });
      setUser((u) => (u ? { ...u, categories: res.categories } : u));
      return res;
    } catch (err) {
      setUser((u) => (u ? { ...u, categories: prev } : u));
      throw err;
    }
  };

  const updateCurrency = async (currency) => {
    // Optimistic: show the new currency immediately, roll back on failure.
    const prev = user?.currency;
    setUser((u) => (u ? { ...u, currency } : u));
    try {
      const res = await api.patch("/auth/currency", { currency });
      setUser((u) => (u ? { ...u, currency: res.currency } : u));
      return res;
    } catch (err) {
      setUser((u) => (u ? { ...u, currency: prev } : u));
      throw err;
    }
  };

  const updateTheme = async ({ accent, mode }) => {
    const body = {};
    if (accent !== undefined) body.accent = accent;
    if (mode !== undefined) body.mode = mode;

    // Optimistic: apply the new theme in the UI immediately, then persist it in
    // the background. On API failure, revert to the previous theme.
    const prevAccent = user?.themeAccent;
    const prevMode = user?.themeMode;
    setUser((u) =>
      u
        ? {
            ...u,
            themeAccent: accent ?? u.themeAccent,
            themeMode: mode ?? u.themeMode,
          }
        : u
    );

    try {
      const res = await api.patch("/auth/theme", body);
      return res;
    } catch (err) {
      setUser((u) =>
        u
          ? {
              ...u,
              themeAccent: prevAccent ?? u.themeAccent,
              themeMode: prevMode ?? u.themeMode,
            }
          : u
      );
      throw err;
    }
  };

  // Apply the user's theme to <html> so every page/components follow instantly.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.themeaccent = user?.themeAccent || "default";
    root.dataset.thememode = user?.themeMode || "light";
  }, [user?.themeAccent, user?.themeMode]);

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout, updateCategories, updateCurrency, updateTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
