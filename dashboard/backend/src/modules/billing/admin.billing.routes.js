// ============================================
// FILE: backend/src/modules/billing/admin.billing.routes.js
// ============================================
import { Router } from 'express';
import adminBillingController, { requireAdmin } from './admin.billing.controller.js';
import { authRequired } from '../../middleware/auth.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authRequired);
router.use(requireAdmin);

// Plans management
router.post('/plans', adminBillingController.createPlan);
router.put('/plans/:planId', adminBillingController.updatePlan);
router.delete('/plans/:planId', adminBillingController.deletePlan);

// Customers
router.get('/customers', adminBillingController.getAllCustomers);
router.get('/customers/:userId', adminBillingController.getCustomerDetails);
router.post('/customers/:userId/upgrade', adminBillingController.manualUpgrade);
router.post('/customers/:userId/quota', adminBillingController.setCustomQuota);

// Analytics
router.get('/analytics', adminBillingController.getRevenueAnalytics);
router.get('/failed-payments', adminBillingController.getFailedPayments);

export default router;
