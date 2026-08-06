import type { Product } from '@/types/cms';

export const products: Product[] = [
  {
    id: 'prod_cooling_relief_cap',
    slug: 'cooling-relief-cap',
    name: 'Icebrim Cooling Relief Cap',
    category: 'Cooling Caps',
    sku: 'ICB-CAP-001',
    price: 44.99,
    offerPrice: 34.99,
    currency: 'GBP',
    stock: 128,
    shortDescription:
      'A 360° cooling gel cap designed for soothing comfort during migraines, tension headaches, and menopausal hot flushes — reusable, drug-free, and fitted to contour gently around the eyes and nose.',
    description:
      'The Icebrim Cooling Relief Cap is built to fix what other cooling caps get wrong. A flexible gel core stays soft and comfortably cold straight from the freezer, so there is no painful cold shock. The contoured nose bridge and full 360° coverage keep it in place whether you are lying down or moving around the house, and dense, light-absorbing fabric across the eyes helps with brightness sensitivity during a migraine. It also doubles as a gentle warm compress when heated briefly. Rated for a 5-year functional lifespan with proper flat, dry storage.',
    images: [
      {
        id: 'img_crc_1',
        src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
        alt: 'Icebrim Cooling Relief Cap, teal cooling gel head cap with contoured eye area, shown from the front',
      },
    ],
    specs: [
      { label: 'Coverage', value: '360° full head, contoured nose bridge' },
      { label: 'Core material', value: 'Flexible cooling gel' },
      { label: 'Use cases', value: 'Migraines, tension headaches, hot flushes' },
      { label: 'Reusable', value: 'Yes — refreeze and reuse' },
      { label: 'Lifespan', value: 'Up to 5 years with proper storage' },
      { label: 'Care', value: 'Wipe clean, store flat in freezer bag' },
    ],
    seo: {
      title: 'Icebrim Cooling Relief Cap | Drug-Free Migraine & Hot Flush Relief',
      description:
        'A 360° cooling gel cap for migraines, tension headaches, and menopausal hot flushes. Reusable, drug-free, shaped to actually fit.',
    },
    published: true,
    ratingAverage: 4.8,
    ratingCount: 4,
  },
  {
    id: 'prod_twin_pack',
    slug: 'cooling-cap-twin-pack',
    name: 'Icebrim Rotation Twin Pack',
    category: 'Cooling Caps',
    sku: 'ICB-CAP-002',
    price: 69.98,
    offerPrice: 59.49,
    currency: 'GBP',
    stock: 64,
    shortDescription:
      'Two Cooling Relief Caps, so one is always ready in the freezer while the other is in use — ideal for frequent migraine days, hot flushes, or sharing with a partner.',
    description:
      'Get two Icebrim Cooling Relief Caps so there is always a cold one ready. Perfect for people with frequent migraine days, regular hot flushes, or households sharing one freezer. Keep one at home and one at the office, or rotate between the two for back-to-back relief sessions without waiting for a refreeze.',
    images: [
      {
        id: 'img_twin_1',
        src: '/assets/products/twin-pack/hero.jpg',
        alt: 'Two Icebrim Cooling Relief Caps side by side, one in teal packaging',
      },
    ],
    specs: [
      { label: 'Includes', value: '2× Icebrim Cooling Relief Cap' },
      { label: 'Coverage', value: '360° full head, contoured nose bridge' },
      { label: 'Best for', value: 'Frequent use, sharing, always-ready rotation' },
    ],
    seo: {
      title: 'Icebrim Rotation Twin Pack | Two Cooling Relief Caps',
      description:
        'Two Icebrim Cooling Relief Caps so one is always ready in the freezer. Save 15% on the twin pack.',
    },
    published: true,
    ratingAverage: 0,
    ratingCount: 0,
  },
];
