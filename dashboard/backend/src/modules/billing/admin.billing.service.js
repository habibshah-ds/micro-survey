// ============================================
// FILE: backend/src/modules/billing/admin.billing.service.js
// Admin-only billing operations
// ============================================
import { v4 as uuidv4 } from 'uuid';
import db from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

class AdminBillingService {
  // ============================================
  // PLANS MANAGEMENT
  // ============================================

  async createPlan(data) {
    const result = await db.query(
      `INSERT INTO plans (
        id, name, slug, description, monthly_price_cents, yearly_price_cents,
        ls_monthly_variant_id, ls_yearly_variant_id,
        surveys_limit, responses_limit, team_members_limit,
        features, is_active, is_featured, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *`,
      [
        uuidv4(),
        data.name,
        data.slug,
        data.description,
        data.monthlyPriceCents,
        data.yearlyPriceCents,
        data.lsMonthlyVariantId,
        data.lsYearlyVariantId,
        data.surveysLimit,
        data.responsesLimit,
        data.teamMembersLimit,
        JSON.stringify(data.features || []),
        data.isActive !== false,
        data.isFeatured || false,
        data.sortOrder || 0,
      ]
    );

    return result.rows[0];
  }

  async updatePlan(planId, data) {
    const sets = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      sets.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.monthlyPriceCents !== undefined) {
      sets.push(`monthly_price_cents = $${idx++}`);
      values.push(data.monthlyPriceCents);
    }
    if (data.yearlyPriceCents !== undefined) {
      sets.push(`yearly_price_cents = $${idx++}`);
      values.push(data.yearlyPriceCents);
    }
    if (data.surveysLimit !== undefined) {
      sets.push(`surveys_limit = $${idx++}`);
      values.push(data.surveysLimit);
    }
    if (data.responsesLimit !== undefined) {
      sets.push(`responses_limit = $${idx++}`);
      values.push(data.responsesLimit);
    }
    if (data.features !== undefined) {
      sets.push(`features = $${idx++}`);
      values.push(JSON.stringify(data.features));
    }
    if (data.isActive !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(data.isActive);
    }

    values.push(planId);

    const result = await db.query(
      `UPDATE plans SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Plan not found');
    }

    return result.rows[0];
  }

  async deletePlan(planId) {
    // Check if any active subscriptions use this plan
    const check = await db.query(
      `SELECT COUNT(*) FROM subscriptions WHERE plan_id = $1 AND status = 'active'`,
      [planId]
    );

    if (parseInt(check.rows[0].count) > 0) {
      throw ApiError.badRequest('Cannot delete plan with active subscriptions');
    }

    await db.query(`DELETE FROM plans WHERE id = $1`, [planId]);
  }

  // ============================================
  // CUSTOMERS
  // ============================================

  async getAllCustomers(filters = {}) {
    let whereClause = '1=1';
    const params = [];
    let idx = 1;

    if (filters.status) {
      whereClause += ` AND s.status = $${idx++}`;
      params.push(filters.status);
    }

    if (filters.planSlug) {
      whereClause += ` AND p.slug = $${idx++}`;
      params.push(filters.planSlug);
    }

    const result = await db.query(
      `SELECT 
        u.id as user_id,
        u.email,
        u.full_name,
        s.id as subscription_id,
        s.status,
        s.ls_subscription_id,
        s.billing_cycle,
        s.current_period_end,
        s.renews_at,
        s.cancelled_at,
        p.name as plan_name,
        p.slug as plan_slug,
        s.surveys_used,
        s.responses_used,
        s.created_at as subscribed_at
      FROM users u
      LEFT JOIN subscriptions s ON u.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC`,
      params
    );

    return result.rows;
  }

  async getCustomerDetails(userId) {
    const result = await db.query(
      `SELECT 
        u.*,
        s.id as subscription_id,
        s.status as subscription_status,
        s.billing_cycle,
        s.current_period_end,
        s.renews_at,
        p.name as plan_name,
        p.slug as plan_slug
      FROM users u
      LEFT JOIN subscriptions s ON u.subscription_id = s.id
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Customer not found');
    }

    return result.rows[0];
  }

  async manualUpgrade(userId, planId) {
    const plan = await db.query(`SELECT * FROM plans WHERE id = $1`, [planId]);
    
    if (plan.rows.length === 0) {
      throw ApiError.notFound('Plan not found');
    }

    // Get current subscription
    const currentSub = await db.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (currentSub.rows.length > 0) {
      // Update existing subscription
      await db.query(
        `UPDATE subscriptions 
         SET plan_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [planId, currentSub.rows[0].id]
      );
    } else {
      // Create new subscription
      const newSubId = uuidv4();
      await db.query(
        `INSERT INTO subscriptions (
          id, user_id, plan_id, ls_subscription_id, ls_variant_id,
          status, billing_cycle, usage_reset_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [newSubId, userId, planId, `manual_${uuidv4()}`, 'manual', 'active', 'monthly']
      );

      await db.query(
        `UPDATE users SET subscription_id = $1 WHERE id = $2`,
        [newSubId, userId]
      );
    }

    return { message: 'Customer upgraded successfully' };
  }

  async setCustomQuota(userId, quotas) {
    const subscription = await db.query(
      `SELECT id FROM subscriptions WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (subscription.rows.length === 0) {
      throw ApiError.notFound('No active subscription');
    }

    const meta = await db.query(
      `SELECT metadata FROM subscriptions WHERE id = $1`,
      [subscription.rows[0].id]
    );

    const metadata = meta.rows[0].metadata || {};
    metadata.customQuotas = quotas;

    await db.query(
      `UPDATE subscriptions SET metadata = $1 WHERE id = $2`,
      [JSON.stringify(metadata), subscription.rows[0].id]
    );

    return { message: 'Custom quotas set' };
  }

  // ============================================
  // REVENUE ANALYTICS
  // ============================================

  async getRevenueAnalytics() {
    // MRR (Monthly Recurring Revenue)
    const mrrResult = await db.query(
      `SELECT 
        SUM(CASE 
          WHEN s.billing_cycle = 'monthly' THEN p.monthly_price_cents 
          WHEN s.billing_cycle = 'yearly' THEN p.yearly_price_cents / 12
        END) / 100.0 as mrr
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status IN ('active', 'on_trial')`
    );

    const mrr = parseFloat(mrrResult.rows[0].mrr || 0);

    // ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // Active subscriptions
    const activeResult = await db.query(
      `SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'on_trial')`
    );
    const activeSubscriptions = parseInt(activeResult.rows[0].count);

    // Churn rate (cancelled in last 30 days)
    const churnResult = await db.query(
      `SELECT 
        COUNT(*) FILTER (WHERE cancelled_at >= NOW() - INTERVAL '30 days') as churned,
        COUNT(*) as total_active
      FROM subscriptions
      WHERE status = 'active' OR cancelled_at >= NOW() - INTERVAL '30 days'`
    );

    const churnRate =
      churnResult.rows[0].total_active > 0
        ? (parseFloat(churnResult.rows[0].churned) / parseFloat(churnResult.rows[0].total_active)) * 100
        : 0;

    // Monthly revenue trend (last 12 months)
    const trendResult = await db.query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(amount_cents) / 100.0 as revenue
      FROM invoices
      WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month DESC`
    );

    // Plan distribution
    const planDistResult = await db.query(
      `SELECT 
        p.name,
        p.slug,
        COUNT(*) as count
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status IN ('active', 'on_trial')
      GROUP BY p.name, p.slug
      ORDER BY count DESC`
    );

    return {
      mrr,
      arr,
      activeSubscriptions,
      churnRate: parseFloat(churnRate.toFixed(2)),
      monthlyRevenueTrend: trendResult.rows,
      planDistribution: planDistResult.rows,
    };
  }

  async getFailedPayments() {
    const result = await db.query(
      `SELECT 
        u.email,
        u.full_name,
        s.id as subscription_id,
        s.ls_subscription_id,
        s.current_period_end,
        p.name as plan_name
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status = 'past_due'
      ORDER BY s.current_period_end ASC`
    );

    return result.rows;
  }
}

export default new AdminBillingService();
