import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("tg_user");
    if (stored) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);

  const login = async (loginInput, password) => {
    const data = await authService.login(loginInput, password);
    localStorage.setItem("tg_token", data.access_token);
    localStorage.setItem("tg_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("tg_token");
    localStorage.removeItem("tg_user");
    setUser(null);
  };

  const updateUser = useCallback((updatedUser) => {
    localStorage.setItem("tg_user", JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  const hasPermission = useCallback(
    (perm) => (user?.permissions ?? []).includes(perm),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
