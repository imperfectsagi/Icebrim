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
    alt: string;
  };
  trustBadges: string[];
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
}

/* --------------------------------- Gallery -------------------------------- */

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  category?: string;
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
