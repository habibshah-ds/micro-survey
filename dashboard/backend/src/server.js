// ============================================
// Server Entry Point - FIXED
// Secure startup with validation and proper error handling
// ============================================
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { config } from "./config/index.js";
import db from "./config/db.js";
import routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logSanitizerMiddleware } from "./middleware/logSanitizer.js";
import { setCsrfToken, verifyCsrfToken } from "./middleware/csrf.js";
import { rateLimitMiddleware, authRateLimiter } from "./middleware/rateLimit.middleware.js";
import { logger } from "./lib/logger.js";

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: config.nodeEnv === "production",
  })
);

// =============================================
// CORS configuration - FIXED (string OR array)
// =============================================
const corsOrigins =
  typeof config.cors.origins === "string"
    ? config.cors.origins.split(",").map((o) => o.trim())
    : config.cors.origins;

app.use(
  cors({
    origin: corsOrigins,
    credentials: config.cors.credentials,
  })
);

// Trust proxy if configured
if (config.security.trustProxy) {
  app.set("trust proxy", 1);
  logger.info("Trust proxy enabled");
}

// Rate limiting
app.use("/api/", rateLimitMiddleware);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(compression());

// Log sanitizer
app.use(logSanitizerMiddleware);

// CSRF protection
app.use(setCsrfToken);
app.use("/api/auth/refresh", verifyCsrfToken);
app.use("/api/auth/logout", verifyCsrfToken);

// Auth rate limiter
app.use("/api/auth/login", authRateLimiter);
app.use("/api/auth/register", authRateLimiter);

// Logging
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      skip: (req) => req.path === "/api/health",
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// API routes
app.use("/api", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Micro-Survey Dashboard API",
    version: "2.0.0",
    status: "running",
    environment: config.nodeEnv,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

let server;

async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      db.pool.end(() => {
        logger.info("Database pool closed");
        process.exit(0);
      });
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Start server
async function startServer() {
  try {
    await db.testConnection();

    const PORT = config.port;
    server = app.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════╗
║   🚀 Micro-Survey Dashboard API                       ║
║                                                       ║
║   Environment: ${config.nodeEnv.padEnd(33)}║
║   Port:        ${PORT.toString().padEnd(33)}║
║   Database:    Connected ✅                           ║
║                                                       ║
║   API:         http://localhost:${PORT}/api              ║
║   Health:      http://localhost:${PORT}/api/health       ║
║   Tenants:     http://localhost:${PORT}/api/tenants      ║
║   Surveys:     http://localhost:${PORT}/api/surveys      ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
