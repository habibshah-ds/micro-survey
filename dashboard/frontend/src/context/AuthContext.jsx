// frontend/src/context/AuthContext.jsx - ENHANCED
import React, { createContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if access token exists and is valid
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.getCurrentUser();
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Auth check failed:", error);
      
      // Try to refresh token
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          await refreshAccessToken();
        } catch (refreshError) {
          // Refresh failed, clear tokens
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsAuthenticated(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    checkAuth();

    // Set up auto-refresh every 10 minutes
    const refreshInterval = setInterval(async () => {
      const token = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (token && refreshToken) {
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error("Auto-refresh failed:", error);
        }
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(refreshInterval);
  }, [checkAuth]);

  // Login function
  async function login(email, password) {
    try {
      const response = await api.login(email, password);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Register function
  async function register(email, password, fullName) {
    try {
      const response = await api.register(email, password, fullName);
      setUser(response.data.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  }

  // Refresh access token
  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refreshToken");
    
    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch(`${api.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Token refresh failed");
      }

      // Update access token
      api.setToken(data.data.accessToken);
      
      return data;
    } catch (error) {
      console.error("Token refresh error:", error);
      throw error;
    }
  }

  // Logout function
  async function logout() {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }

  // Update user data
  function updateUser(userData) {
    setUser(prevUser => ({
      ...prevUser,
      ...userData,
    }));
  }

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    refresh: refreshAccessToken,
    setUser: updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
