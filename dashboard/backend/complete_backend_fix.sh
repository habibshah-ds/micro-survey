#!/bin/bash
# Complete Backend Fix Script
# Run this from the backend directory

cd ~/project/dashboard/backend

echo "🔧 Creating all missing files..."

# ============================================
# 1. CREATE MISSING MIDDLEWARE FILES
# ============================================

# middleware/validate.js
cat > src/middleware/validate.js << 'EOF'
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    req.body = value;
    next();
  };
}
EOF

# middleware/auth.js (FIXED)
cat > src/middleware/auth.js << 'EOF'
import { verifyToken } from "../utils/jwt.js";

export function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token" 
    });
  }
}

export default authRequired;
EOF

# ============================================
# 2. CREATE MISSING UTILS FILES
# ============================================

# utils/jwt.js
cat > src/utils/jwt.js << 'EOF'
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessTokenExpiry,
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshTokenExpiry,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}
EOF

# utils/ApiResponse.js
cat > src/utils/ApiResponse.js << 'EOF'
export class ApiResponse {
  static success(res, statusCode = 200, message = "Success", data = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, message = "Created", data = {}) {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static paginated(res, data, page, limit, total, message = "Success") {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  }
}
EOF

# utils/asyncHandler.js
cat > src/utils/asyncHandler.js << 'EOF'
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
EOF

# ============================================
# 3. FIX CONFIG FILES
# ============================================

# config/index.js (COMPLETE)
cat > src/config/index.js << 'EOF'
import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  
  database: {
    url: process.env.DATABASE_URL,
    poolMax: 10,
    poolMin: 2,
    idleTimeout: 30000,
    connectionTimeout: 2000,
  },

  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
    accessTokenExpiry: process.env.ACCESS_TOKEN_EXP || "15m",
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXP || "7d",
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  },
};

// Legacy exports for backwards compatibility
export const DATABASE_URL = config.database.url;
export const JWT_SECRET = config.jwt.secret;
export const ACCESS_TOKEN_EXP = config.jwt.accessTokenExpiry;
export const REFRESH_TOKEN_EXP = config.jwt.refreshTokenExpiry;
EOF

# ============================================
# 4. FIX AUTH MODULE
# ============================================

# auth.service.js (COMPLETE)
cat > src/modules/auth/auth.service.js << 'EOF'
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import db from "../../config/db.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function register({ email, password, fullName }) {
  const existing = await db.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    throw new AppError("Email already registered", 400);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.query(
    `INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING id, email, full_name, role, created_at`,
    [uuidv4(), email, passwordHash, fullName, "user"]
  );

  const user = result.rows[0];

  const accessToken = signAccessToken({ 
    userId: user.id, 
    email: user.email, 
    role: user.role 
  });
  
  const refreshToken = signRefreshToken({ 
    userId: user.id 
  });

  await db.query(
    `INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
    [uuidv4(), refreshToken, user.id]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function login({ email, password }) {
  const result = await db.query(
    "SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1",
    [email]
  );

  const user = result.rows[0];
  
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  if (!user.is_active) {
    throw new AppError("Account is disabled", 403);
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  
  if (!isValidPassword) {
    throw new AppError("Invalid email or password", 401);
  }

  await db.query(
    "UPDATE users SET last_login_at = NOW() WHERE id = $1",
    [user.id]
  );

  const accessToken = signAccessToken({ 
    userId: user.id, 
    email: user.email, 
    role: user.role 
  });
  
  const refreshToken = signRefreshToken({ 
    userId: user.id 
  });

  await db.query(
    `INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())`,
    [uuidv4(), refreshToken, user.id]
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(refreshToken) {
  try {
    const decoded = verifyToken(refreshToken);

    const result = await db.query(
      "SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1",
      [refreshToken]
    );

    if (result.rows.length === 0) {
      throw new AppError("Invalid refresh token", 401);
    }

    const tokenData = result.rows[0];

    if (new Date(tokenData.expires_at) < new Date()) {
      throw new AppError("Refresh token expired", 401);
    }

    const userResult = await db.query(
      "SELECT id, email, role FROM users WHERE id = $1 AND is_active = true",
      [tokenData.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError("User not found", 404);
    }

    const user = userResult.rows[0];

    const accessToken = signAccessToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    });

    return { accessToken };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Invalid refresh token", 401);
  }
}

export async function logout(refreshToken) {
  await db.query(
    "DELETE FROM refresh_tokens WHERE token = $1",
    [refreshToken]
  );
}

export async function getCurrentUser(userId) {
  const result = await db.query(
    `SELECT id, email, full_name, role, is_email_verified, created_at, last_login_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = result.rows[0];
  
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    isEmailVerified: user.is_email_verified,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const result = await db.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError("User not found", 404);
  }

  const user = result.rows[0];
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isValidPassword) {
    throw new AppError("Current password is incorrect", 400);
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await db.query(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [newPasswordHash, userId]
  );

  await db.query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
}
EOF

# auth.controller.js (COMPLETE)
cat > src/modules/auth/auth.controller.js << 'EOF'
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as authService from "./auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: result,
  });
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user,
      accessToken: result.accessToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Refresh token required",
    });
  }

  const result = await authService.refreshAccessToken(refreshToken);

  res.json({
    success: true,
    data: result,
  });
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie("refreshToken");

  res.json({
    success: true,
    message: "Logout successful",
  });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.userId);

  res.json({
    success: true,
    data: { user },
  });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(req.user.userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: "Password changed successfully",
  });
});

export default {
  register,
  login,
  refresh,
  logout,
  getCurrentUser,
  changePassword,
};
EOF

# ============================================
# 5. CREATE ANALYTICS CONTROLLER
# ============================================

cat > src/modules/analytics/analytics.controller.js << 'EOF'
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as analyticsService from "./analytics.service.js";

export const getQuestionAnalytics = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const { startDate, endDate, countryCode } = req.query;

  const analytics = await analyticsService.getQuestionAnalytics(
    req.user.userId,
    questionId,
    { startDate, endDate, countryCode }
  );

  res.json({
    success: true,
    data: analytics,
  });
});

export const getOrganizationAnalytics = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const analytics = await analyticsService.getOrganizationAnalytics(
    req.user.userId,
    organizationId
  );

  res.json({
    success: true,
    data: analytics,
  });
});

export const recordResponse = asyncHandler(async (req, res) => {
  const result = await analyticsService.recordResponse(req.body);

  res.status(201).json({
    success: true,
    message: "Response recorded",
    data: result,
  });
});

export default {
  getQuestionAnalytics,
  getOrganizationAnalytics,
  recordResponse,
};
EOF

# ============================================
# 6. CREATE INTEGRATION CONTROLLER
# ============================================

cat > src/modules/integration/integration.controller.js << 'EOF'
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as integrationService from "./integration.service.js";

export const registerSite = asyncHandler(async (req, res) => {
  const result = await integrationService.registerSite(req.user.userId, req.body);

  res.status(201).json({
    success: true,
    message: "Site registered successfully",
    data: result,
  });
});

export const getSiteStats = asyncHandler(async (req, res) => {
  const { siteKey } = req.params;

  const stats = await integrationService.getSiteStats(siteKey);

  res.json({
    success: true,
    data: stats,
  });
});

export const pushResponses = asyncHandler(async (req, res) => {
  const { siteKey, responses } = req.body;

  const result = await integrationService.pushResponses(siteKey, responses);

  res.status(201).json({
    success: true,
    message: "Responses recorded successfully",
    data: result,
  });
});

export const getActiveQuestions = asyncHandler(async (req, res) => {
  const { siteKey } = req.query;

  const questions = await integrationService.getActiveQuestions(siteKey);

  res.json({
    success: true,
    data: { questions },
  });
});

export default {
  registerSite,
  getSiteStats,
  pushResponses,
  getActiveQuestions,
};
EOF

# ============================================
# 7. FIX QUESTIONS SERVICE
# ============================================

cat > src/modules/questions/questions.service.js << 'EOF'
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { AppError } from '../../middleware/errorHandler.js';

class QuestionsService {
  async create(userId, data) {
    const orgCheck = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND owner_id = $2',
      [data.organizationId, userId]
    );

    if (orgCheck.rows.length === 0) {
      throw new AppError('Organization not found or access denied', 403);
    }

    const result = await db.query(
      `INSERT INTO questions (
        id, organization_id, question_text, question_type, 
        options, is_active, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        uuidv4(),
        data.organizationId,
        data.questionText,
        data.questionType,
        JSON.stringify(data.options || []),
        data.isActive !== false,
      ]
    );

    const question = result.rows[0];
    question.options = JSON.parse(question.options);
    return question;
  }

  async getAll(userId, filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE o.owner_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.organizationId) {
      whereClause += ` AND q.organization_id = $${paramIndex}`;
      params.push(filters.organizationId);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      whereClause += ` AND q.is_active = $${paramIndex}`;
      params.push(filters.isActive);
      paramIndex++;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       ${whereClause}`,
      params
    );

    params.push(limit, offset);

    const result = await db.query(
      `SELECT q.*, o.name as organization_name
       FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       ${whereClause}
       ORDER BY q.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const questions = result.rows.map(q => ({
      ...q,
      options: JSON.parse(q.options),
    }));

    return {
      questions,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getById(questionId, userId) {
    const result = await db.query(
      `SELECT q.*, o.name as organization_name
       FROM questions q
       JOIN organizations o ON q.organization_id = o.id
       WHERE q.id = $1 AND o.owner_id = $2`,
      [questionId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Question not found', 404);
    }

    const question = result.rows[0];
    question.options = JSON.parse(question.options);
    return question;
  }

  async update(questionId, userId, updates) {
    await this.getById(questionId, userId);

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (updates.questionText) {
      setClauses.push(`question_text = $${paramIndex}`);
      params.push(updates.questionText);
      paramIndex++;
    }

    if (updates.questionType) {
      setClauses.push(`question_type = $${paramIndex}`);
      params.push(updates.questionType);
      paramIndex++;
    }

    if (updates.options) {
      setClauses.push(`options = $${paramIndex}`);
      params.push(JSON.stringify(updates.options));
      paramIndex++;
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex}`);
      params.push(updates.isActive);
      paramIndex++;
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(questionId);

    const result = await db.query(
      `UPDATE questions 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      params
    );

    const question = result.rows[0];
    question.options = JSON.parse(question.options);
    return question;
  }

  async delete(questionId, userId) {
    await this.getById(questionId, userId);
    await db.query('DELETE FROM questions WHERE id = $1', [questionId]);
  }
}

export default new QuestionsService();
EOF

# ============================================
# 8. FIX ORGANIZATIONS ROUTES
# ============================================

cat > src/modules/organizations/organizations.routes.js << 'EOF'
import { Router } from 'express';
import organizationsController from './organizations.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import { createOrganizationSchema, updateOrganizationSchema } from './organizations.validation.js';

const router = Router();

router.use(authRequired);

router.post('/', validate(createOrganizationSchema), organizationsController.create);
router.get('/', organizationsController.getAll);
router.get('/:id', organizationsController.getById);
router.put('/:id', validate(updateOrganizationSchema), organizationsController.update);
router.delete('/:id', organizationsController.delete);

export default router;
EOF

# ============================================
# 9. FIX QUESTIONS ROUTES
# ============================================

cat > src/modules/questions/questions.routes.js << 'EOF'
import { Router } from 'express';
import questionsController from './questions.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRequired } from '../../middleware/auth.js';
import { createQuestionSchema, updateQuestionSchema } from './questions.validation.js';

const router = Router();

router.use(authRequired);

router.post('/', validate(createQuestionSchema), questionsController.create);
router.get('/', questionsController.getAll);
router.get('/:id', questionsController.getById);
router.put('/:id', validate(updateQuestionSchema), questionsController.update);
router.delete('/:id', questionsController.delete);

export default router;
EOF

# ============================================
# 10. FIX ROUTES INDEX
# ============================================

cat > src/routes/index.js << 'EOF'
import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import organizationsRoutes from "../modules/organizations/organizations.routes.js";
import questionsRoutes from "../modules/questions/questions.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import integrationRoutes from "../modules/integration/integration.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Survay CAPTCHA Dashboard API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      organizations: "/api/organizations",
      questions: "/api/questions",
      analytics: "/api/analytics",
      integration: "/api/integration",
    },
  });
});

router.use("/auth", authRoutes);
router.use("/organizations", organizationsRoutes);
router.use("/questions", questionsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/integration", integrationRoutes);

router.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;
EOF

echo "✅ All files created successfully!"
echo ""
echo "🔧 Now running migrations and starting server..."

# Reset database
PGPASSWORD=H@bib123 psql -U postgres -d dashboard -c "DROP TABLE IF EXISTS migrations CASCADE;" 2>/dev/null || true

# Run migrations
npm run migrate

# Start server
echo ""
echo "🚀 Starting server..."
npm start
EOF

chmod +x complete_backend_fix.sh
