/**
 * CMS content types.
 *
 * These types define the shape of every piece of admin-editable content on
 * the site. They are the contract between:
 *   - the D1 database schema (see /workers/db/schema.sql)
 *   - the Workers API responses (see /workers/src/routes)
 *   - the React frontend (reads via useContent hooks)
 *   - the Admin Panel (reads + writes via the same API)
 *
 * Keeping one shared type module means the admin form, the API validator
 * (Zod schemas mirror these shapes), and the public site can never drift
 * out of sync silently -- a field renamed here breaks the build everywhere
 * it's used, instead of failing silently at runtime.
 */

export interface Cta {
  label: string;
  href: string;
}

export interface SeoMeta {
  title: string;
  description: string;
  ogImage?: string;
  canonicalPath?: string;
}

/* ---------------------------------- Home --------------------------------- */

export interface HeroBannerContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  description: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  image: {
    src: string;
    /** Optional mobile-specific composition -- see HeroBanner.tsx, which renders this via <picture>/<source> below the sm breakpoint. Falls back to `src` when unset, so existing content with only a desktop image keeps working unchanged. Should be composed for a narrow viewport (subject framed for a tall/narrow crop), not just the desktop image scaled down -- see ADDITIONAL_PRODUCTION_REQUIREMENTS §6 for why a naive crop of the desktop image doesn't work here (the gradient/text-overlay composition on the left assumes the desktop image's wide aspect ratio and negative space). */
    mobileSrc?: string;
    alt: string;
  };
  /** 'image' (default) | 'video' | 'gif'. When 'video', `videoSrc` holds the clip URL and `image.src` (if set) is used as the poster/fallback. */
  mediaType?: 'image' | 'video' | 'gif';
  videoSrc?: string;
  trustBadges: string[];
  /** Optional hex color override for the eyebrow/heading/description text (e.g. "#1a2b2c"). Falls back to the site's default theme text colors when unset -- see HeroBanner.tsx. */
  textColor?: string;
}

export interface HowItWorksStep {
  id: string;
  title: string;
  description: string;
}

export interface HowItWorksContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  steps: HowItWorksStep[];
}

export interface WhyFeature {
  id: string;
  title: string;
  description: string;
}

export interface WhyChooseUsContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  features: WhyFeature[];
}

export interface FeaturedProductsContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  productSlugs: string[];
}

export interface AboutSectionContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  body: string;
  image: { src: string; alt: string };
  cta?: Cta;
}

export interface ReviewsSectionContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  maxDisplayed: number;
}

export interface BlogSectionContent {
  visible: boolean;
  eyebrow: string;
  heading: string;
  maxDisplayed: number;
}

export interface CtaSectionContent {
  visible: boolean;
  heading: string;
  description: string;
  cta: Cta;
  image: { src: string; alt: string };
}

export interface HomePageContent {
  seo: SeoMeta;
  hero: HeroBannerContent;
  howItWorks: HowItWorksContent;
  whyChooseUs: WhyChooseUsContent;
  featuredProducts: FeaturedProductsContent;
  about: AboutSectionContent;
  reviews: ReviewsSectionContent;
  blog: BlogSectionContent;
  cta: CtaSectionContent;
}

/* -------------------------------- Company -------------------------------- */

export interface BusinessHours {
  day: string;
  hours: string;
}

export interface CompanySettings {
  name: string;
  legalName: string;
  aboutShort: string;
  address: string;
  phone: string;
  whatsapp?: string;
  email: string;
  googleMapsEmbedUrl?: string;
  social: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    twitter?: string;
  };
  footerNote: string;
  copyright: string;
  businessHours: BusinessHours[];
  logo: { src: string; alt: string };
  logoIcon?: { src: string; alt: string };
}

/* --------------------------------- Policy --------------------------------- */

/** Fixed set -- see routes/admin-content.ts / routes/content.ts POLICY_KEYS. */
export type PolicyPageKey = 'policy_privacy' | 'policy_cookie' | 'policy_terms';

export interface PolicyPageContent {
  title: string;
  /** Sanitized server-side on save (see workers/src/lib/sanitize-html.ts) and re-sanitized client-side on render (see RichText.tsx) -- same defense-in-depth pipeline as blog post content. */
  contentHtml: string;
  /** Human-facing date string the admin sets directly, e.g. "1 August 2026" -- not parsed as a real date. */
  updatedDateLabel: string;
}

/* ---------------------------------- Pages --------------------------------- */

/** Generic, admin-created CMS page (Page Management) -- distinct from the fixed policy pages above. See workers/src/routes/pages.ts. */
export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  /** Sanitized server-side on save (see workers/src/lib/sanitize-html.ts) and re-sanitized client-side on render -- same pipeline as blog post content. */
  contentHtml: string;
  status: 'draft' | 'published';
  seo: SeoMeta;
  createdAt: string;
  updatedAt: string;
}

/** Site-wide ON/OFF promo announcement strip, optionally linking to one product or page. See workers/src/routes/admin-content.ts (site_content key "promo_banner"). */
export interface PromoBannerContent {
  enabled: boolean;
  text: string;
  linkType: 'none' | 'product' | 'page';
  linkSlug: string;
}

/* -------------------------------- Products -------------------------------- */

export interface ProductImage {
  id: string;
  src: string;
  alt: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  sku: string;
  price: number;
  offerPrice?: number;
  currency: string;
  stock: number;
  shortDescription: string;
  description: string;
  images: ProductImage[];
  /** Optional product video, alongside the images gallery above -- shown on the product detail page in addition to the photo gallery. */
  videoUrl?: string;
  specs: ProductSpec[];
  seo: SeoMeta;
  published: boolean;
  ratingAverage: number;
  ratingCount: number;
}

/* ---------------------------------- Blog ---------------------------------- */

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  featuredImage: { src: string; alt: string };
  /** 'image' (default) | 'video' | 'gif'. When 'video', `featuredVideoSrc` holds the clip and `featuredImage.src` (if set) is the poster frame. */
  featuredMediaType?: 'image' | 'video' | 'gif';
  featuredVideoSrc?: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published';
  publishedAt: string;
  seo: SeoMeta;
}

/* --------------------------------- Reviews -------------------------------- */

export interface Review {
  id: string;
  productSlug: string;
  authorName: string;
  location?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  /** 'none' (default) | 'image' | 'video' -- an optional customer-attached photo or short video review. */
  mediaType?: 'none' | 'image' | 'video';
  mediaSrc?: string;
  /** Additional customer-attached photos, alongside the single mediaType/mediaSrc slot above -- see migration 0010_review_multi_image.sql. */
  mediaImages?: string[];
}

/* --------------------------------- Gallery -------------------------------- */

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  category?: string;
  /** 'image' (default) | 'video' | 'gif' */
  mediaType?: 'image' | 'video' | 'gif';
  videoSrc?: string;
}

/* -------------------------------- Contact --------------------------------- */

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

/* ------------------------------ E-commerce -------------------------------- */

/**
 * A single line in the cart, keyed by productId. Deliberately snapshots
 * only what's needed to render the cart UI (name, image, unit price,
 * available stock) -- the actual price charged at checkout is always
 * re-verified server-side from the product record (see
 * workers/src/routes/orders.ts), never trusted from this client-side
 * snapshot. If it drifts (price changed, product went out of stock) the
 * checkout API call surfaces that as an error instead of silently
 * charging the stale price.
 */
export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  image: string;
  unitPrice: number;
  currency: string;
  quantity: number;
  /** Stock available at the time this was added/last synced -- used only for a client-side max-quantity hint, not enforced as truth. */
  availableStock: number;
}

export interface ShippingAddressInput {
  name: string;
  email: string;
  phone?: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  country: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'payment_failed';

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: { name: string; email: string; phone?: string };
  shipping: { line1: string; line2?: string; city: string; postalCode: string; country: string };
  currency: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  couponCode?: string;
  total: number;
  status: OrderStatus;
  paymentProvider?: 'stripe' | 'razorpay';
  paymentReference?: string;
  paidAt?: string;
  tracking?: { number: string; carrier?: string };
  shippedAt?: string;
  deliveredAt?: string;
  customerNote?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

/* --------------------------------- Coupon --------------------------------- */

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  /** Percentage points (1-100) if discountType is 'percentage', decimal currency amount if 'fixed' -- matches workers/src/lib/coupons.ts's CouponRow convention. */
  discountValue: number;
  active: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  usedCount: number;
  minOrderSubtotal?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}
