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
  // Optional customer-attached photo or short video review.
  mediaType: z.enum(['none', 'image', 'video']).optional(),
  mediaSrc: z.string().max(500).optional(),
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
