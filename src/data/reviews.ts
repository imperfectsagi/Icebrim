import type { Review } from '@/types/cms';

export const reviews: Review[] = [
  {
    id: 'rev_1',
    productSlug: 'cooling-relief-cap',
    authorName: 'Priya K.',
    location: 'Manchester',
    rating: 5,
    title: 'My hot flush emergency kit',
    body:
      "I keep one in the office freezer and one at home. The second it hits me I know exactly what to reach for. It's soft enough that I don't feel silly wearing it in front of my kids either, which was a real worry with the bulkier one I had before.",
    status: 'approved',
    createdAt: '2026-04-02',
  },
  {
    id: 'rev_2',
    productSlug: 'cooling-relief-cap',
    authorName: 'Helen R.',
    location: 'Guildford, Surrey',
    rating: 5,
    title: 'Finally, one that actually fits',
    body:
      "I've tried three other cooling caps and they either slipped off my nose or warmed up in ten minutes flat. This one stays put and stays cold for my whole 20-minute session. I keep it by the freezer door now — genuinely part of my evening routine during a bad migraine week.",
    status: 'approved',
    createdAt: '2026-03-11',
  },
  {
    id: 'rev_3',
    productSlug: 'cooling-relief-cap',
    authorName: 'Sarah T.',
    location: 'Bristol',
    rating: 4,
    title: "Doesn't hurt to put on, unlike my old one",
    body:
      'The big difference for me is that it doesn\u2019t feel painfully cold the second it comes out of the freezer — my old cap was almost unbearable for the first minute. This one is soft and cold straight away without the shock.',
    status: 'approved',
    createdAt: '2026-05-08',
  },
];
