// ============================================
// FILE: backend/src/routes/index.js (UPDATED)
// Add embed routes for widget
// ============================================
import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import organizationsRoutes from "../modules/organizations/organizations.routes.js";
import questionsRoutes from "../modules/questions/questions.routes.js";
import analyticsRoutes from "../modules/analytics/analytics.routes.js";
import integrationRoutes from "../modules/integration/integration.routes.js";
import tenantsRoutes from "../modules/tenants/tenants.routes.js";
import surveysRoutes from "../modules/surveys/surveys.routes.js";
import webhooksRoutes from "../modules/webhooks/webhooks.routes.js";
import embedRoutes from "../modules/embed/embed.routes.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Survey CAPTCHA Dashboard API",
    version: "2.0.0",
    endpoints: {
      auth: "/api/auth",
      tenants: "/api/tenants",
      surveys: "/api/surveys",
      organizations: "/api/organizations",
      questions: "/api/questions",
      analytics: "/api/analytics",
      integration: "/api/integration",
      webhooks: "/api/webhooks",
      embed: "/api/embed (PUBLIC)",
    },
  });
});

// Protected routes (require authentication)
router.use("/auth", authRoutes);
router.use("/organizations", organizationsRoutes);
router.use("/questions", questionsRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/integration", integrationRoutes);
router.use("/tenants", tenantsRoutes);
router.use("/surveys", surveysRoutes);
router.use("/webhooks", webhooksRoutes);

// Public routes (no auth required)
router.use("/embed", embedRoutes);

router.get("/health", (req, res) => {
  res.json({ 
    success: true, 
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

export default router;
