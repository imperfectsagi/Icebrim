import type { CompanySettings } from '@/types/cms';

export const companySettings: CompanySettings = {
  name: 'Icebrim',
  legalName: 'Icebrim Ltd',
  aboutShort:
    'Reusable cooling comfort caps for migraines, tension headaches, and menopause hot flushes — designed for real UK weeks.',
  address: 'Registered in England and Wales',
  phone: '+44 20 0000 0000',
  whatsapp: '+44 7000 000000',
  email: 'hello@icebrim.com',
  googleMapsEmbedUrl: '',
  social: {
    instagram: 'https://instagram.com/icebrim',
    facebook: 'https://facebook.com/icebrim',
    tiktok: 'https://tiktok.com/@icebrim',
  },
  footerNote:
    'Icebrim products are comfort and self-care accessories and are not intended to diagnose, treat, cure, or prevent any medical condition.',
  copyright: '© {year} Icebrim Ltd. All rights reserved. Registered in England and Wales.',
  businessHours: [
    { day: 'Monday – Friday', hours: '9:00 AM – 5:30 PM' },
    { day: 'Saturday', hours: '10:00 AM – 2:00 PM' },
    { day: 'Sunday', hours: 'Closed' },
  ],
  logo: { src: '/assets/brand/logo.png', alt: 'Icebrim' },
  logoIcon: { src: '/assets/brand/logo.png', alt: 'Icebrim' },
};
