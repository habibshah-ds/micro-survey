// frontend/src/components/ProtectedRoute.jsx - ENHANCED
import React, { useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { PageLoader } from "./ui/LoadingSpinner";

export default function ProtectedRoute({ children, requireAuth = true }) {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return <PageLoader text="Checking authentication..." />;
  }

  // Redirect to login if not authenticated and auth is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render children if authenticated or auth not required
  return children;
}
