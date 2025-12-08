// ============================================
// FILE: backend/src/modules/billing/admin.billing.controller.js
// ============================================
import { asyncHandler } from '../../utils/asyncHandler.js';
import adminBillingService from './admin.billing.service.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';

// Middleware to check admin role
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }
  next();
};

class AdminBillingController {
  // Plans
  createPlan = asyncHandler(async (req, res) => {
    const plan = await adminBillingService.createPlan(req.body);
    ApiResponse.created(res, 'Plan created', { plan });
  });

  updatePlan = asyncHandler(async (req, res) => {
    const plan = await adminBillingService.updatePlan(req.params.planId, req.body);
    ApiResponse.success(res, 200, 'Plan updated', { plan });
  });

  deletePlan = asyncHandler(async (req, res) => {
    await adminBillingService.deletePlan(req.params.planId);
    ApiResponse.success(res, 200, 'Plan deleted');
  });

  // Customers
  getAllCustomers = asyncHandler(async (req, res) => {
    const customers = await adminBillingService.getAllCustomers(req.query);
    ApiResponse.success(res, 200, 'Customers retrieved', { customers });
  });

  getCustomerDetails = asyncHandler(async (req, res) => {
    const customer = await adminBillingService.getCustomerDetails(req.params.userId);
    ApiResponse.success(res, 200, 'Customer retrieved', { customer });
  });

  manualUpgrade = asyncHandler(async (req, res) => {
    const result = await adminBillingService.manualUpgrade(
      req.params.userId,
      req.body.planId
    );
    ApiResponse.success(res, 200, result.message);
  });

  setCustomQuota = asyncHandler(async (req, res) => {
    const result = await adminBillingService.setCustomQuota(
      req.params.userId,
      req.body.quotas
    );
    ApiResponse.success(res, 200, result.message);
  });

  // Analytics
  getRevenueAnalytics = asyncHandler(async (req, res) => {
    const analytics = await adminBillingService.getRevenueAnalytics();
    ApiResponse.success(res, 200, 'Analytics retrieved', analytics);
  });

  getFailedPayments = asyncHandler(async (req, res) => {
    const failed = await adminBillingService.getFailedPayments();
    ApiResponse.success(res, 200, 'Failed payments retrieved', { failed });
  });
}

export default new AdminBillingController();
