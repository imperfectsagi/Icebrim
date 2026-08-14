import { z } from 'zod';

/**
 * These schemas validate every admin write (POST/PUT/PATCH) at the API
 * boundary, independent of whatever the frontend form already validated.
 * Client-side validation is for UX; these are what actually protect the
 * database from malformed or malicious input (mass assignment, XSS
 * payloads smuggled into text fields, oversized payloads, etc).
 */

export const ctaSchema = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(300),
});

export const seoMetaSchema = z.object({
  title: z.string().min(1).max(70),
  description: z.string().min(1).max(160),
  ogImage: z.string().max(500).optional(),
  canonicalPath: z.string().max(300).optional(),
});

export const productImageSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1).max(500),
  alt: z.string().min(1).max(200),
});

export const productSpecSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(200),
});

export const productWriteSchema = z.object({
  name: z.string().min(2).max(150),
  slug: z
    .string()
    .min(2)
    .max(150)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  category: z.string().min(1).max(80),
  sku: z.string().min(1).max(50),
  price: z.number().nonnegative().max(1_000_000),
  offerPrice: z.number().nonnegative().max(1_000_000).optional(),
  currency: z.string().length(3).default('GBP'),
  stock: z.number().int().min(0).max(1_000_000),
  shortDescription: z.string().min(1).max(500),
  description: z.string().min(1).max(20_000),
  images: z.array(productImageSchema).min(1).max(20),
  specs: z.array(productSpecSchema).max(50),
  seo: seoMetaSchema,
  published: z.boolean(),
  ratingAverage: z.number().min(0).max(5).default(0),
  ratingCount: z.number().int().min(0).default(0),
  // Optional product video, alongside the images gallery above -- same
  // "alongside the images" relationship as BlogPost.featuredVideoSrc.
  videoUrl: z.string().max(500).optional(),
});

export const blogWriteSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  excerpt: z.string().min(1).max(500),
  contentHtml: z.string().min(1).max(100_000),
  featuredImage: z.object({ src: z.string().max(500), alt: z.string().min(1).max(200) }),
  // Optional: the featured media can be a video/gif instead of a static
  // image. featuredMediaType defaults to 'image' for backward
  // compatibility with posts created before this field existed.
  featuredMediaType: z.enum(['image', 'video', 'gif']).optional(),
  featuredVideoSrc: z.string().max(500).optional(),
  category: z.string().min(1).max(80),
  tags: z.array(z.string().min(1).max(40)).max(20),
  author: z.string().min(1).max(100),
  status: z.enum(['draft', 'published']),
  publishedAt: z.string().min(1).max(40),
  seo: seoMetaSchema,
});

export const reviewSubmitSchema = z.object({
  productSlug: z.string().min(1).max(150),
  authorName: z.string().min(2).max(80),
  location: z.string().max(80).optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().min(3).max(120),
  body: z.string().min(10).max(2000),
  // Optional customer-attached short video review (see mediaType/mediaSrc
  // comment on the reviews table -- kept as the existing single slot).
  mediaType: z.enum(['none', 'image', 'video']).optional(),
  mediaSrc: z.string().max(500).optional(),
  // Optional customer-attached photos, additive to the single slot above
  // -- see migration 0010_review_multi_image.sql for why this is a
  // separate field rather than folded into mediaType/mediaSrc.
  mediaImages: z.array(z.string().max(500)).max(6).optional(),
  // Honeypot: a hidden field real visitors never see or fill. We
  // deliberately do NOT reject a non-empty value here at the schema
  // level -- doing so would return a 400 that tells an automated
  // submitter their honeypot was detected. Instead validation accepts
  // any value (capped at a generous length to bound payload size), and
  // the route handler checks it and returns a fake-success response,
  // so bots get no signal that anything was different about this
  // submission.
  companyWebsite: z.string().max(200).optional(),
});

export const reviewModerateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// Full edit of a review's content by an admin (correcting a typo, adjusting
// a miscategorized rating, etc). All fields optional so a partial PATCH
// only touches what's sent; status is handled separately by
// reviewModerateSchema/the moderate endpoint to keep that action explicit.
export const reviewEditSchema = z.object({
  authorName: z.string().min(2).max(80).optional(),
  location: z.string().max(80).nullable().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().min(3).max(120).optional(),
  body: z.string().min(10).max(2000).optional(),
  mediaType: z.enum(['none', 'image', 'video']).optional(),
  mediaSrc: z.string().max(500).nullable().optional(),
  mediaImages: z.array(z.string().max(500)).max(6).optional(),
});

export const contactMessageSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  subject: z.string().min(3).max(150),
  message: z.string().min(10).max(3000),
  // See the comment on reviewSubmitSchema.companyWebsite -- same reasoning.
  companyWebsite: z.string().max(200).optional(),
});

export const newsletterSchema = z.object({
  email: z.string().email().max(200),
});

export const categoryWriteSchema = z.object({
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
});

export const galleryImageWriteSchema = z.object({
  src: z.string().max(500),
  alt: z.string().min(1).max(200),
  caption: z.string().max(300).optional(),
  category: z.string().max(80).optional(),
  // Optional: this entry can be a video or animated GIF instead of a
  // static image. mediaType defaults to 'image' server-side (see the
  // route handler) for entries created before this field existed.
  mediaType: z.enum(['image', 'video', 'gif']).optional(),
  videoSrc: z.string().max(500).optional(),
}).refine((v) => (v.mediaType === 'video' ? (v.videoSrc?.length ?? 0) > 0 : v.src.length > 0), {
  message: 'An image, GIF, or video is required',
  path: ['src'],
});

// Same fields as create, but every field is optional so PATCH can update
// just one field (e.g. only the caption) without resending everything.
export const galleryImagePatchSchema = z.object({
  src: z.string().max(500).optional(),
  alt: z.string().min(1).max(200).optional(),
  caption: z.string().max(300).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  mediaType: z.enum(['image', 'video', 'gif']).optional(),
  videoSrc: z.string().max(500).nullable().optional(),
});

export const galleryReorderSchema = z.object({
  // Ordered array of gallery image IDs, front-to-back. Every ID present
  // gets sort_order set to its index in this array.
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export const businessHoursSchema = z.object({
  day: z.string().min(1).max(40),
  hours: z.string().min(1).max(40),
});

export const companySettingsWriteSchema = z.object({
  name: z.string().min(1).max(100),
  legalName: z.string().min(1).max(150),
  aboutShort: z.string().min(1).max(500),
  address: z.string().min(1).max(300),
  phone: z.string().min(1).max(30),
  whatsapp: z.string().max(30).optional(),
  email: z.string().email().max(200),
  googleMapsEmbedUrl: z.string().max(1000).optional(),
  social: z.object({
    instagram: z.string().max(300).optional(),
    facebook: z.string().max(300).optional(),
    tiktok: z.string().max(300).optional(),
    twitter: z.string().max(300).optional(),
  }),
  footerNote: z.string().min(1).max(500),
  copyright: z.string().min(1).max(300),
  businessHours: z.array(businessHoursSchema).max(10),
  logo: z.object({ src: z.string().min(1).max(500), alt: z.string().min(1).max(200) }),
  logoIcon: z.object({ src: z.string().min(1).max(500), alt: z.string().min(1).max(200) }).optional(),
});

export const userAccountUpdateSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().max(200),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200)
    .regex(/[A-Z]/, 'Must include an uppercase letter')
    .regex(/[0-9]/, 'Must include a number')
    .regex(/[^A-Za-z0-9]/, 'Must include a symbol'),
});

// ---------------------------------------------------------------------------
// E-commerce: checkout / orders
// ---------------------------------------------------------------------------

/**
 * What the client sends to start a checkout. Deliberately contains NO
 * price -- only productId + quantity. Every price used to compute the
 * order total is re-read from the database server-side (see
 * routes/orders.ts createOrder), because trusting a client-supplied price
 * would let anyone pay whatever they want for anything.
 */
export const checkoutLineItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});

export const shippingAddressSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2, 'Use a 2-letter country code, e.g. GB'),
});

export const checkoutCreateSchema = z.object({
  items: z.array(checkoutLineItemSchema).min(1).max(50),
  shipping: shippingAddressSchema,
  customerNote: z.string().max(500).optional(),
  paymentProvider: z.enum(['stripe', 'razorpay']),
  couponCode: z.string().max(30).optional(),
});

export const couponPreviewSchema = z.object({
  items: z.array(checkoutLineItemSchema).min(1).max(50),
  couponCode: z.string().min(1).max(30),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum(['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'payment_failed']),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(100).optional(),
  trackingCarrier: z.string().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Policy pages (Privacy Policy, Cookie Policy, Terms & Conditions) --
// CMS-editable via the admin panel using the same rich-text pipeline as
// blog posts: contentHtml is sanitized server-side (see
// lib/sanitize-html.ts sanitizeBlogHtml) before it's stored, exactly the
// same defense as blog content, since this is likewise
// admin-authored-but-still-worth-defending-in-depth HTML that gets
// rendered with dangerouslySetInnerHTML on the public site.
// ---------------------------------------------------------------------------
export const policyPageWriteSchema = z.object({
  title: z.string().min(1).max(200),
  contentHtml: z.string().max(100_000), // empty string allowed: an admin may clear a page while drafting
  updatedDateLabel: z.string().min(1).max(50), // human-facing date string, e.g. "1 August 2026" -- not parsed/validated as a real date since it's just display text the admin controls directly
});

// ---------------------------------------------------------------------------
// Page Management -- generic, admin-created CMS pages (as opposed to the
// three fixed policy pages above). See migration 0008_pages.sql and
// routes/pages.ts. Same rich-text sanitization pipeline as blog posts.
// ---------------------------------------------------------------------------
export const pageWriteSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  contentHtml: z.string().max(100_000), // empty string allowed while drafting
  status: z.enum(['draft', 'published']),
  seo: z.object({
    title: z.string().max(70).optional().default(''),
    description: z.string().max(160).optional().default(''),
  }),
});

// ---------------------------------------------------------------------------
// Promo banner note (ON/OFF site-wide announcement strip). See
// routes/admin-content.ts. linkSlug is validated only as a slug-shaped
// string here -- whether it actually resolves to a real, published
// product or page is a display-time concern (see PromoBanner.tsx, which
// simply doesn't render a link if the slug it's given doesn't match
// anything), not something this write-time schema needs to check via a
// DB lookup.
export const promoBannerWriteSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(200),
  linkType: z.enum(['none', 'product', 'page']),
  linkSlug: z.string().max(200).optional().default(''),
});

// ---------------------------------------------------------------------------
// Coupons -- see migration 0007_coupons.sql and lib/coupons.ts for the
// validation/discount-calculation logic that reads this data at checkout.
// discountValue means different things depending on discountType (percentage
// points 1-100, or pence for 'fixed') -- see coupons.ts's CouponRow for the
// same convention on the read side.
// ---------------------------------------------------------------------------
export const couponWriteSchema = z
  .object({
    code: z
      .string()
      .min(3, 'Code must be at least 3 characters')
      .max(30, 'Code must be 30 characters or fewer')
      .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers, and hyphens only'),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.number().positive(),
    active: z.boolean(),
    expiresAt: z.string().datetime().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    minOrderSubtotal: z.number().min(0).optional().nullable(), // decimal pounds, converted to pence in the route (same convention as checkout)
  })
  .refine((v) => (v.discountType === 'percentage' ? v.discountValue >= 1 && v.discountValue <= 100 : true), {
    message: 'Percentage discount must be between 1 and 100',
    path: ['discountValue'],
  });

