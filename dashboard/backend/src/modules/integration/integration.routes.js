import { Router } from "express";
import integrationController from "./integration.controller.js";
import { authRequired } from "../../middleware/auth.js";

const router = Router();

// Protected route - register new site
router.post("/captcha/register-site", authRequired, integrationController.registerSite);

// Public routes - for captcha-API integration
router.get("/captcha/stats/:siteKey", integrationController.getSiteStats);
router.post("/captcha/push-responses", integrationController.pushResponses);
router.get("/captcha/questions", integrationController.getActiveQuestions);

export default router;
