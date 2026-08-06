import type { HomePageContent } from '@/types/cms';

/**
 * Default / seed content for the Home page.
 *
 * In production this record is fetched from `GET /api/content/home`
 * (Cloudflare Worker -> D1) and the Admin Panel writes back to the same
 * row via `PUT /api/content/home`. This local object is the fallback used
 * in local development and functions as the documented shape of that row.
 */
export const homeContent: HomePageContent = {
  seo: {
    title: 'Icebrim — Cooling Relief Caps for Migraines & Menopause',
    description:
      'Icebrim makes reusable cooling comfort caps for migraines, tension headaches, and menopause hot flushes. Drug-free relief, shaped to actually fit.',
    canonicalPath: '/',
  },
  hero: {
    visible: true,
    eyebrow: 'Drug-free, reusable comfort',
    heading: "Relief that's ready before the pain is.",
    description:
      'A 360° cooling cap for migraines, tension headaches, and menopause hot flushes — shaped to actually fit, formulated to stay comfortably cold, and ready in your freezer whenever you need it.',
    primaryCta: { label: 'Shop the Cooling Cap', href: '/products/cooling-relief-cap' },
    secondaryCta: { label: 'How it works', href: '#how-it-works' },
    image: {
      src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
      alt: 'A woman relaxing at home wearing the Icebrim Cooling Relief Cap',
    },
    trustBadges: ['Free UK delivery over £30', '30-day returns', '5-year lifespan'],
  },
  howItWorks: {
    visible: true,
    eyebrow: 'How it works',
    heading: "Three steps between you and relief",
    steps: [
      {
        id: 'freeze',
        title: 'Freeze',
        description:
          'Store your cap flat in the freezer for at least 2 hours before first use. Keep it in its bag between sessions.',
      },
      {
        id: 'apply',
        title: 'Apply',
        description:
          'Pull it on over clean skin. The contoured nose opening and 360° shape settle into place without any adjustment.',
      },
      {
        id: 'relief',
        title: 'Relief',
        description:
          'Rest for 15–20 minutes while even, gentle cooling and full light-blocking take over. Reuse once refrozen.',
      },
    ],
  },
  whyChooseUs: {
  visible: true,
  eyebrow: 'Why Icebrim',
  heading: 'Built to fix what other cooling caps get wrong',
  features: [
    {
      id: 'soft-cold',
      title: 'Stays soft, stays cold',
      description:
        'Our gel core is formulated to remain flexible and comfortable straight from the freezer — no painful cold shock, no early warm-up.',
    },
    {
      id: 'fit',
      title: 'Shaped to actually fit',
      description:
        'A contoured nose bridge and 360° coverage mean it stays in place, whether you’re lying down or moving around the house.',
    },
    {
      id: 'light-blocking',
      title: 'Full light-blocking',
      description:
        'Dense, light-absorbing fabric across the eyes helps with sensitivity to brightness during a migraine.',
    },
    {
      id: 'warm-compress',
      title: 'Doubles as a warm compress',
      description:
        'Heat it gently for 20–60 seconds to ease tight muscles in the head, temples, or neck.',
    },
    {
      id: 'durable',
      title: 'Built to last years, not months',
      description:
        'Rated for a 5-year functional lifespan with proper flat, dry storage — just wipe clean and refreeze.',
    },
  ],
},
  featuredProducts: {
    visible: true,
    eyebrow: 'Shop',
    heading: 'Find your relief kit',
    productSlugs: ['cooling-cap-twin-pack', 'cooling-relief-cap'],
  },
  about: {
    visible: true,
    eyebrow: 'About Icebrim',
    heading: 'Comfort, designed around real UK weeks',
    body:
      'Icebrim started with a simple frustration: cooling caps that slipped, warmed up too fast, or felt painfully cold the moment they left the freezer. We set out to build one that actually fits, actually stays cold, and actually gets reached for on a bad day — not left in a drawer after the first try.',
    image: {
      src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
      alt: 'Icebrim Cooling Relief Cap on a soft neutral background',
    },
    cta: { label: 'Read our story', href: '/about' },
  },
  reviews: {
    visible: true,
    eyebrow: 'Real customers',
    heading: 'Trusted across the UK',
    maxDisplayed: 3,
  },
  blog: {
    visible: true,
    eyebrow: 'From the blog',
    heading: 'Guides for migraines, menopause, and self-care',
    maxDisplayed: 3,
  },
  cta: {
    visible: true,
    heading: "Relief shouldn't wait for a chemist run.",
    description: "Keep one in the freezer, and it's ready the moment you need it.",
    cta: { label: 'Shop the Cooling Cap', href: '/products/cooling-relief-cap' },
    image: {
      src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
      alt: 'Icebrim Cooling Relief Cap',
    },
  },
};
