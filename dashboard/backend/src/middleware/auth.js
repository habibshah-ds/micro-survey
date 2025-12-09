// ============================================
// FILE: backend/src/middleware/auth.js (SECURITY FIXED)
// ============================================
import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";

export function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // SECURITY: Remove development bypass - force authentication
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
      message: error.message || "Invalid or expired token" 
    });
  }
}

export default authRequired;
