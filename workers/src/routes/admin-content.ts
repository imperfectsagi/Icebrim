import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth, requireAdminRole } from '../middleware/auth';
import {
  companySettingsWriteSchema,
  policyPageWriteSchema,
  promoBannerWriteSchema,
  deliveryInfoWriteSchema,
  popupOfferWriteSchema,
  systemSettingsWriteSchema,
} from '../lib/schemas';
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  applySystemSettingsUpdate,
  getSystemSettings,
  isMaintenanceActive,
} from '../lib/system-settings';
import { sanitizeBlogHtml } from '../lib/sanitize-html';
import { logAuditEvent, getClientIp } from '../lib/login-security';
import { toDecimal } from '../lib/money';
import type { CouponRow } from '../lib/coupons';
import { getSiteContentRaw, getSiteContentWithMeta, upsertSiteContent, applyRevalidatingCache, notModified } from '../lib/site-content';

export const adminContent = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminContent.use('*', requireAuth);

// Home page content: admin reads/writes the full JSON blob. Deep
// per-field Zod validation of every nested home-page section would add
// a large schema for limited benefit here (there's no cross-entity
// integrity to protect, unlike products/blog), so we validate structure
// at the type level in the frontend and cap the payload size here as a
// pragmatic safeguard against abuse.
const MAX_CONTENT_JSON_BYTES = 200_000;

adminContent.get('/home', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'home');
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/home', async (c) => {
  const body = await c.req.text();
  if (body.length > MAX_CONTENT_JSON_BYTES) return c.json({ error: 'Payload too large' }, 413);
  const parsed = JSON.parse(body);

  await upsertSiteContent(c.env.DB, 'home', parsed, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'home_content_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json(parsed);
});

adminContent.get('/company', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'company');
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/company', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = companySettingsWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid company settings' }, 400);

  await upsertSiteContent(c.env.DB, 'company', parsed.data, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'company_settings_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
  });

  return c.json(parsed.data);
});

// ---------------------------------------------------------------------------
// SEO settings / System settings -- same pattern, admin-only (not editor)
// since these affect the whole site rather than individual content items.
// ---------------------------------------------------------------------------
export const adminSettings = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminSettings.use('*', requireAuth, requireAdminRole);

adminSettings.get('/seo', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'seo_settings');
  return c.json(value ?? {});
});

adminSettings.put('/seo', async (c) => {
  const body = await c.req.text();
  if (body.length > MAX_CONTENT_JSON_BYTES) return c.json({ error: 'Payload too large' }, 413);
  const parsed = JSON.parse(body);
  await upsertSiteContent(c.env.DB, 'seo_settings', parsed, c.get('userId'));
  return c.json(parsed);
});

// ---------------------------------------------------------------------------
// Policy pages (Privacy Policy, Cookie Policy, Terms & Conditions, Return &
// Refund Policy) -- same site_content key/value pattern as home/company
// above, so the admin can manage them without a code deployment for every
// text change. Content is sanitized server-side with the same allowlist
// sanitizer used for blog posts (see lib/sanitize-html.ts) since it's
// rendered with dangerouslySetInnerHTML on the public site (see
// src/components/common/RichText.tsx, which also re-sanitizes client-side
// as defense in depth).
//
// Keyed as 'policy_privacy' / 'policy_cookie' / 'policy_terms' /
// 'policy_refund' in site_content -- four fixed keys (not a generic "any
// slug" CMS) because there are exactly four policy pages the frontend
// routes to (PrivacyPolicyPage / CookiePolicyPage / TermsPage /
// ReturnRefundPolicyPage, see src/router.tsx), and an open-ended slug
// system would need its own routing/404 handling this app doesn't have.
// ---------------------------------------------------------------------------
const POLICY_KEYS = ['policy_privacy', 'policy_cookie', 'policy_terms', 'policy_refund'] as const;
type PolicyKey = (typeof POLICY_KEYS)[number];

function isPolicyKey(value: string): value is PolicyKey {
  return (POLICY_KEYS as readonly string[]).includes(value);
}

adminContent.get('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  const value = await getSiteContentRaw(c.env.DB, key);
  if (!value) return c.json({ error: 'Not seeded yet' }, 404);
  return c.json(value);
});

adminContent.put('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  const body = await c.req.json().catch(() => null);
  const parsed = policyPageWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid policy page content' }, 400);

  const clean = { ...parsed.data, contentHtml: sanitizeBlogHtml(parsed.data.contentHtml) };
  await upsertSiteContent(c.env.DB, key, clean, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'policy_page_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { policyKey: key },
  });

  return c.json(clean);
});

// Delete = reset to empty rather than removing the row entirely: the
// public page component (PrivacyPolicyPage.tsx etc.) always renders at
// its fixed route regardless of whether content has been saved, so a
// missing site_content row would show a 404-shaped "Not seeded yet" API
// response, and the public page falls back to an "unavailable" state
// instead of erroring. This matches the effect the client asked for
// ("admin can delete a policy page's content") without introducing a
// separate "does this route exist" concept the frontend router doesn't
// otherwise have.
adminContent.delete('/policy/:key', async (c) => {
  const key = c.req.param('key');
  if (!isPolicyKey(key)) return c.json({ error: 'Unknown policy page' }, 404);

  await c.env.DB.prepare('DELETE FROM site_content WHERE key = ?').bind(key).run();
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'policy_page_deleted',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { policyKey: key },
  });

  return c.body(null, 204);
});

// ---------------------------------------------------------------------------
// Theme (brand accent color) -- same site_content pattern as the rest of
// this file. Stored as a single hex color; the frontend applies it by
// overriding the --color-coral* CSS variables at the document root, so one
// saved value re-colors buttons, links, active nav state, and focus rings
// across both the public site and the admin panel without touching
// individual components.
// ---------------------------------------------------------------------------
const hexColor = /^#[0-9a-fA-F]{6}$/;

adminSettings.get('/theme', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'theme');
  return c.json(value ?? { accentColor: '#11534E' });
});

adminSettings.put('/theme', async (c) => {
  const body = await c.req.json().catch(() => null);
  const accentColor = (body as { accentColor?: string } | null)?.accentColor;
  if (typeof accentColor !== 'string' || !hexColor.test(accentColor)) {
    return c.json({ error: 'accentColor must be a hex color like #11534E' }, 400);
  }

  await upsertSiteContent(c.env.DB, 'theme', { accentColor }, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'theme_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { accentColor },
  });

  return c.json({ accentColor });
});

// ---------------------------------------------------------------------------
// Promo banner note -- a site-wide ON/OFF announcement strip (e.g. "Free
// shipping this weekend"), optionally linking to one product or page by
// slug. Same site_content key/value pattern as theme/home above. Kept
// admin-only (not requireAdminRole) since editors already manage
// comparable site-wide text content (home banner, policy pages) via
// adminContent elsewhere in this file.
// ---------------------------------------------------------------------------
adminContent.get('/promo-banner', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'promo_banner');
  return c.json(value ?? { enabled: false, text: '', linkType: 'none', linkSlug: '' });
});

adminContent.put('/promo-banner', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = promoBannerWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid promo banner content' }, 400);

  await upsertSiteContent(c.env.DB, 'promo_banner', parsed.data, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'promo_banner_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { enabled: parsed.data.enabled },
  });

  return c.json(parsed.data);
});

// ---------------------------------------------------------------------------
// Delivery information (estimated delivery time, e.g. "2-4 working days")
// -- same site_content key/value pattern as promo_banner above. Admin-only
// (not requireAdminRole) for the same reason promo-banner is: editors
// already manage comparable site-wide text content elsewhere in this file.
// See lib/schemas.ts's deliveryInfoWriteSchema and
// src/components/common/DeliveryInfo.tsx (the one shared component every
// public display location renders, so there is exactly one place the
// saved text is read and formatted).
// ---------------------------------------------------------------------------
adminContent.get('/delivery-info', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'delivery_info');
  return c.json(value ?? { enabled: false, text: '' });
});

adminContent.put('/delivery-info', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = deliveryInfoWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid delivery information' }, 400);

  await upsertSiteContent(c.env.DB, 'delivery_info', parsed.data, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'delivery_info_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { enabled: parsed.data.enabled },
  });

  return c.json(parsed.data);
});

// ---------------------------------------------------------------------------
// Customer offer popup -- same site_content key/value pattern as
// promo_banner/delivery_info above (site_content key "popup_offer"). See
// migration 0013_popup_offer_emails.sql for why only this settings
// document lives here while the submitted emails get their own table,
// and lib/schemas.ts's popupOfferWriteSchema for why couponId (not a
// code snapshot) is what's stored -- it always resolves against the
// live coupon record on read, so admin changes to that coupon (price,
// active flag, expiry) are reflected immediately without a second edit
// here. Admin-only (not requireAdminRole) for the same reason
// promo-banner/delivery-info are: editors already manage comparable
// site-wide content elsewhere in this file.
// ---------------------------------------------------------------------------
const POPUP_OFFER_DEFAULT = { enabled: false, heading: '', subheading: '', couponId: null as string | null };

adminContent.get('/popup-offer', async (c) => {
  const value = await getSiteContentRaw(c.env.DB, 'popup_offer');
  return c.json(value ?? POPUP_OFFER_DEFAULT);
});

adminContent.put('/popup-offer', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = popupOfferWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid popup settings' }, 400);
  const input = parsed.data;

  // Validate the referenced coupon actually exists before saving --
  // same "don't let the admin panel save a dangling reference" rule
  // applied to linkSlug on promo_banner, but enforced here (unlike
  // linkSlug) because a coupon id is a real foreign-key-shaped
  // reference into a table this same admin manages, not free text.
  if (input.couponId) {
    const coupon = await c.env.DB.prepare('SELECT id FROM coupons WHERE id = ?').bind(input.couponId).first();
    if (!coupon) return c.json({ error: 'Selected coupon could not be found' }, 400);
  }

  await upsertSiteContent(c.env.DB, 'popup_offer', input, c.get('userId'));
  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'popup_offer_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { enabled: input.enabled, couponId: input.couponId },
  });

  return c.json(input);
});

// Submitted popup emails -- read-only list for the admin panel (see
// routes/popup-emails.ts for the public submit endpoint that writes
// these rows). Shows exactly the three fields requirement #2 asks for:
// email, submission time, and the coupon shown at that time (already
// captured as a snapshot at submit time -- see migration
// 0013_popup_offer_emails.sql -- so this is a plain read with no join
// needed, and stays correct even after a coupon is later deleted).
interface PopupOfferEmailRow {
  id: string;
  email: string;
  coupon_code: string | null;
  created_at: string;
}

adminContent.get('/popup-offer/emails', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, email, coupon_code, created_at FROM popup_offer_emails ORDER BY created_at DESC',
  ).all<PopupOfferEmailRow>();
  return c.json(
    results.map((r) => ({
      id: r.id,
      email: r.email,
      couponCode: r.coupon_code,
      createdAt: r.created_at,
    })),
  );
});

adminSettings.get('/system', async (c) => {
  const settings = await getSystemSettings(c.env.DB);
  return c.json({ ...settings, maintenanceActive: isMaintenanceActive(settings) });
});

adminSettings.put('/system', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = systemSettingsWriteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid system settings' }, 400);

  const previous = await getSystemSettings(c.env.DB);
  const next = applySystemSettingsUpdate(previous, parsed.data);
  await upsertSiteContent(c.env.DB, 'system_settings', next, c.get('userId'));

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'system_settings_updated',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: {
      maintenanceMode: next.maintenanceMode,
      maintenanceDurationDays: next.maintenanceDurationDays,
      sessionTimeoutMinutes: next.sessionTimeoutMinutes,
    },
  });

  return c.json({ ...next, maintenanceActive: isMaintenanceActive(next) });
});

// ---------------------------------------------------------------------------
// Public: maintenance-mode flag only. Deliberately separate from the
// authenticated /api/admin/settings/system route above -- the public site
// needs to read this on every visit (no auth cookie required, cacheable),
// while the full settings object (session timeout, etc.) stays admin-only.
// ---------------------------------------------------------------------------
export const publicSettings = new Hono<{ Bindings: Env }>();

publicSettings.get('/maintenance', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'system_settings');
  const settings = await getSystemSettings(c.env.DB);
  const active = isMaintenanceActive(settings);

  // Revalidate on every use (see lib/site-content.ts) so flipping the switch
  // in the admin panel takes effect on the very next visitor request instead
  // of lingering in a cache. The flag is part of the version because an
  // auto-ending window changes state with time, not with an edit.
  const version = `${row?.updatedAt ?? 'none'}:${active ? 'on' : 'off'}`;
  const notModifiedResponse = notModified(c, version);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, version);

  return c.json({
    maintenanceMode: active,
    maintenanceMessage: settings.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
    maintenanceDurationDays: active ? settings.maintenanceDurationDays : 0,
    maintenanceEndsAt: active ? settings.maintenanceEndsAt : null,
  });
});

publicSettings.get('/theme', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'theme');
  const value = row?.value as { accentColor?: string } | undefined;
  // See lib/site-content.ts's applyRevalidatingCache -- this replaces the
  // previous fixed `public, max-age=300`, which is exactly the "color
  // theme" case named by the stale-content-flash bug report.
  const notModifiedResponse = notModified(c, row?.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row?.updatedAt);
  return c.json({ accentColor: value?.accentColor ?? '#11534E' });
});

publicSettings.get('/promo-banner', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'promo_banner');
  const value = row?.value as
    | { enabled?: boolean; text?: string; linkType?: 'none' | 'product' | 'page'; linkSlug?: string }
    | undefined;
  const notModifiedResponse = notModified(c, row?.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row?.updatedAt);
  return c.json({
    enabled: value?.enabled ?? false,
    text: value?.text ?? '',
    linkType: value?.linkType ?? 'none',
    linkSlug: value?.linkSlug ?? '',
  });
});

publicSettings.get('/delivery-info', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'delivery_info');
  const value = row?.value as { enabled?: boolean; text?: string } | undefined;
  const notModifiedResponse = notModified(c, row?.updatedAt);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, row?.updatedAt);
  return c.json({
    enabled: value?.enabled ?? false,
    text: value?.text ?? '',
  });
});

// ---------------------------------------------------------------------------
// Public: the customer offer popup's current configuration, with its
// linked coupon resolved into the shape the popup actually displays
// (code, discount type/value, minimum order) rather than exposing the
// raw couponId. Requirement #4 (checkout coupon offer) reads this same
// endpoint, which is what keeps "only show active and valid promotional
// coupons" true in exactly one place: if the linked coupon has since
// been deactivated, deleted, or expired, `coupon` below comes back null
// and BOTH the popup and the checkout display simply show nothing for
// it -- see lib/coupons.ts's validateCoupon for why expiry/active/usage
// are checked the same way checkout itself checks them, so this can
// never disagree with what /orders/validate-coupon would actually accept.
//
// The ETag this endpoint revalidates against combines the popup_offer
// row's own updated_at with the linked coupon's updated_at (when one is
// linked) -- the popup's *displayed offer* can go stale from either
// side changing (the admin edits the popup text, OR edits/deactivates
// the coupon it points at without touching the popup row itself), so
// both have to be part of what invalidates the cached response. See
// lib/site-content.ts's applyRevalidatingCache for why this is
// revalidate-on-load rather than a fixed max-age.
// ---------------------------------------------------------------------------
publicSettings.get('/popup-offer', async (c) => {
  const row = await getSiteContentWithMeta(c.env.DB, 'popup_offer');
  const value = row?.value as
    | { enabled?: boolean; heading?: string; subheading?: string; couponId?: string | null }
    | undefined;

  const base = {
    enabled: value?.enabled ?? false,
    heading: value?.heading ?? '',
    subheading: value?.subheading ?? '',
  };

  if (!base.enabled || !value?.couponId) {
    const notModifiedResponse = notModified(c, row?.updatedAt);
    if (notModifiedResponse) return notModifiedResponse;
    applyRevalidatingCache(c, row?.updatedAt);
    return c.json({ ...base, coupon: null });
  }

  const coupon = await c.env.DB.prepare('SELECT * FROM coupons WHERE id = ?').bind(value.couponId).first<
    CouponRow & { updated_at: string }
  >();

  const combinedVersion = coupon ? `${row?.updatedAt ?? ''}:${coupon.updated_at}` : row?.updatedAt;
  const notModifiedResponse = notModified(c, combinedVersion);
  if (notModifiedResponse) return notModifiedResponse;
  applyRevalidatingCache(c, combinedVersion);

  const isCurrentlyValid =
    !!coupon &&
    !!coupon.active &&
    (!coupon.expires_at || new Date(coupon.expires_at).getTime() >= Date.now()) &&
    (coupon.usage_limit === null || coupon.used_count < coupon.usage_limit);

  if (!isCurrentlyValid) {
    return c.json({ ...base, coupon: null });
  }

  return c.json({
    ...base,
    coupon: {
      code: coupon!.code,
      discountType: coupon!.discount_type,
      discountValue: coupon!.discount_type === 'fixed' ? toDecimal(coupon!.discount_value) : coupon!.discount_value,
      minOrderSubtotal: coupon!.min_order_subtotal_minor === null ? null : toDecimal(coupon!.min_order_subtotal_minor),
    },
  });
});
