// ============================================
// FILE: frontend/src/App.jsx (FIXED IMPORTS)
// ============================================
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import DashboardLayout from "./components/layout/DashboardLayout";

// Pages
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import DashboardPage from "./pages/Dashboard";
import QuestionBuilderPage from "./pages/QuestionBuilder";
import QuestionListPage from "./pages/QuestionList";
import AnalyticsPage from "./pages/Analytics";
import OrganizationsPage from "./pages/Organizations";
import { NotFound } from "./pages/errors/NotFound";
import { Unauthorized } from "./pages/errors/Unauthorized";

// Placeholder pages for future features
const PlaceholderPage = ({ title }) => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
    <p className="text-gray-600 mb-6">This feature is coming soon!</p>
    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg">
      <span className="animate-pulse">🚧</span>
      <span className="font-medium">Under Development</span>
    </div>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes with dashboard layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="organizations" element={<OrganizationsPage />} />
              <Route path="questions" element={<QuestionListPage />} />
              <Route path="questions/new" element={<QuestionBuilderPage />} />
              <Route path="questions/:id/edit" element={<QuestionBuilderPage />} />
              <Route path="analytics" element={<PlaceholderPage title="Analytics" />} />
              <Route path="analytics/:questionId" element={<AnalyticsPage />} />
              <Route path="surveys" element={<PlaceholderPage title="Surveys" />} />
              <Route path="api-keys" element={<PlaceholderPage title="API Keys" />} />
              <Route path="billing" element={<PlaceholderPage title="Billing" />} />
              <Route path="webhooks" element={<PlaceholderPage title="Webhooks" />} />
              <Route path="settings" element={<PlaceholderPage title="Settings" />} />
              <Route path="settings/profile" element={<PlaceholderPage title="Profile Settings" />} />
            </Route>

            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
