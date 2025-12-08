// ============================================
// FILE: backend/src/modules/auth/auth.controller.js
// ENHANCED with password reset endpoints
// ============================================
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as authService from './auth.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

/**
 * Signup - POST /api/auth/signup
 */
export const signup = asyncHandler(async (req, res) => {
  const result = await authService.signup(req.body, req);
  
  // Set refresh token cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
  
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

/**
 * Login - POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);
  
  // Set refresh token cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

/**
 * Refresh token - POST /api/auth/refresh
 */
export const refresh = asyncHandler(async (req, res) => {
  // Get refresh token from cookie (preferred) or body (fallback)
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required',
    });
  }
  
  const result = await authService.refreshAccessToken(refreshToken, req);
  
  // Set new refresh token cookie
  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  
  res.json({
    success: true,
    message: 'Token refreshed',
    data: {
      accessToken: result.accessToken,
    },
  });
});

/**
 * Logout - POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if (refreshToken) {
    await authService.logout(refreshToken, req);
  }
  
  // Clear cookie
  res.clearCookie('refreshToken', { path: '/' });
  
  res.json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * Get current user - GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT id, email, full_name, role, is_email_verified, created_at, last_login_at
     FROM users WHERE id = $1`,
    [req.user.userId]
  );
  
  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  const user = result.rows[0];
  
  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        isEmailVerified: user.is_email_verified,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
    },
  });
});

/**
 * Request password reset - POST /api/auth/request-password-reset
 */
export const requestPasswordReset = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email, req);
  
  // Always return success to prevent email enumeration
  res.json({
    success: true,
    message: result.message,
  });
});

/**
 * Reset password - POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  
  const result = await authService.resetPassword(token, newPassword, req);
  
  res.json({
    success: true,
    message: result.message,
  });
});

export default {
  signup,
  login,
  refresh,
  logout,
  getCurrentUser,
  requestPasswordReset,
  resetPassword,
};
