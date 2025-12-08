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
