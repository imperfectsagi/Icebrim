import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';

export const adminDashboard = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminDashboard.use('*', requireAuth);

function humanizeAction(action: string): string {
  const map: Record<string, string> = {
    login_success: 'Admin signed in',
    product_created: 'Product created',
    product_updated: 'Product updated',
    product_deleted: 'Product deleted',
    blog_post_created: 'Blog post created',
    blog_post_updated: 'Blog post updated',
    blog_post_deleted: 'Blog post deleted',
    review_moderated: 'Review moderated',
    review_deleted: 'Review deleted',
    home_content_updated: 'Home page content updated',
    company_settings_updated: 'Company settings updated',
    password_changed: 'Password changed',
    account_updated: 'Account details updated',
    media_uploaded: 'Image uploaded',
  };
  return map[action] ?? action.replace(/_/g, ' ');
}

adminDashboard.get('/stats', async (c) => {
  const db = c.env.DB;

  const [products, blogs, reviews, pendingReviews, messages, visitors] = await Promise.all([
    db.prepare('SELECT COUNT(*) as n FROM products').first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM blog_posts').first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM reviews').first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) as n FROM reviews WHERE status = 'pending'`).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM contact_messages WHERE read = 0').first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(DISTINCT visitor_hash) as n FROM page_views WHERE created_at >= datetime('now', '-30 days')`)
      .first<{ n: number }>(),
  ]);

  const { results: recentAudit } = await db
    .prepare('SELECT action, created_at FROM audit_log ORDER BY created_at DESC LIMIT 8')
    .all<{ action: string; created_at: string }>();

  // Surface a rolling count of recent payment-path errors on the
  // dashboard itself (not just the dedicated /errors endpoint below) --
  // per FIX-034 Step 2, this is the highest-value category to notice
  // quickly, so it gets a visible number rather than requiring a click
  // into a separate view to discover something's wrong.
  const recentPaymentErrors = await db
    .prepare(
      `SELECT COUNT(*) as n FROM error_log WHERE category IN ('payment', 'webhook') AND created_at >= datetime('now', '-24 hours')`,
    )
    .first<{ n: number }>();

  return c.json({
    totalProducts: products?.n ?? 0,
    totalBlogs: blogs?.n ?? 0,
    totalReviews: reviews?.n ?? 0,
    pendingReviews: pendingReviews?.n ?? 0,
    visitors30d: visitors?.n ?? 0,
    unreadMessages: messages?.n ?? 0,
    paymentErrors24h: recentPaymentErrors?.n ?? 0,
    recentActivity: recentAudit.map((a, i) => ({
      id: String(i),
      label: humanizeAction(a.action),
      timestamp: a.created_at,
    })),
  });
});

/**
 * Recent unhandled/logged errors (see migration 0005_error_log.sql and
 * lib/error-log.ts). Deliberately simple -- no pagination beyond a limit,
 * no filtering UI beyond an optional category query param -- matching
 * FIX-034's explicit scoping ("a full observability platform is likely
 * overkill" for a project this size). Good enough to answer "did
 * something break recently" without waiting for a customer complaint.
 */
adminDashboard.get('/errors', async (c) => {
  const category = c.req.query('category');
  const { results } = category
    ? await c.env.DB.prepare('SELECT * FROM error_log WHERE category = ? ORDER BY created_at DESC LIMIT 100')
        .bind(category)
        .all()
    : await c.env.DB.prepare('SELECT * FROM error_log ORDER BY created_at DESC LIMIT 100').all();

  return c.json(results);
});
