// ============================================
// FILE: backend/src/modules/auth/auth.routes.js
// COMPLETE ROUTES with rate limiting
// ============================================
import { Router } from 'express';
import authController from './auth.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from './auth.middleware.js';
import {
  authRateLimiter,
  passwordResetRateLimiter,
} from '../../middleware/rateLimit.middleware.js';
import {
  signupSchema,
  loginSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from './auth.validators.js';

const router = Router();

// Public routes with rate limiting
router.post(
  '/signup',
  authRateLimiter,
  validate(signupSchema),
  authController.signup
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  authController.login
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refresh
);

router.post(
  '/logout',
  validate(refreshTokenSchema),
  authController.logout
);

router.post(
  '/request-password-reset',
  passwordResetRateLimiter,
  validate(requestPasswordResetSchema),
  authController.requestPasswordReset
);

router.post(
  '/reset-password',
  passwordResetRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword
);

// Protected routes
router.get('/me', authRequired, authController.getCurrentUser);

export default router;
