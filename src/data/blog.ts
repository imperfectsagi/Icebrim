import type { BlogPost } from '@/types/cms';

export const blogPosts: BlogPost[] = [
  {
    id: 'post_gate_control',
    slug: 'gate-control-theory-cold-therapy-headaches',
    title: 'Why Does Cold Feel Good on a Headache? The Science, Explained Simply',
    excerpt:
      "There's real physiology behind why a cold compress feels so immediately soothing during a headache. Here's how it works, in plain English.",
    contentHtml: `<p>When a headache hits, reaching for something cold is one of the oldest self-care habits there is. It turns out there's a well-documented reason it works.</p>
<h2>The short version</h2>
<p>Cold therapy interrupts pain signals through a mechanism called gate control theory. Nerve fibres that carry temperature and pressure signals travel faster than the fibres that carry pain, effectively closing a "gate" in the spinal cord before the pain signal fully registers.</p>
<h2>Why an even, full-coverage cold source matters</h2>
<p>Localised ice packs only affect a small area and warm up quickly. A full-coverage cap keeps the cooling effect even and sustained, which is part of why shape and fit matter as much as temperature.</p>
<h2>The takeaway</h2>
<p>Cold therapy is not a cure, but it is a genuinely evidence-informed way to take the edge off while a headache runs its course.</p>`,
    featuredImage: {
      src: '/assets/blog/gate-control-theory.jpg',
      alt: 'Simple illustration representing nerve signals and cold sensation',
    },
    category: 'Migraines',
    tags: ['science', 'cold therapy', 'migraines'],
    author: 'Icebrim Team',
    status: 'published',
    publishedAt: '2026-04-02',
    seo: {
      title: 'Why Does Cold Feel Good on a Headache? | Icebrim',
      description:
        "The physiology behind why cold therapy soothes headaches, explained in plain English.",
    },
  },
  {
    id: 'post_best_cooling_cap',
    slug: 'best-ice-hat-for-migraines-uk-comparison',
    title: 'Best Cooling Cap for Migraines in the UK: What to Look For (2026)',
    excerpt:
      "Not all cooling caps are built the same. Here's what separates a genuinely comfortable cap from one you'll stop using after a week.",
    contentHtml: `<p>Cooling caps for migraines vary a lot in fit, cold retention, and comfort. Here's what actually matters when comparing them.</p>
<h2>Fit and coverage</h2>
<p>A cap that slips off during rest defeats the purpose. Look for a contoured nose bridge and full 360° coverage.</p>
<h2>Cold shock vs steady cooling</h2>
<p>Some gel cores feel painfully cold straight from the freezer before warming up too fast. A flexible, well-formulated gel stays comfortably cold for the full session.</p>
<h2>Reusability and lifespan</h2>
<p>Cheaper caps often degrade after a handful of freeze cycles. Look for a product rated for years of reuse, not months.</p>`,
    featuredImage: {
      src: '/assets/blog/best-cooling-cap-comparison.jpg',
      alt: 'Several styles of cooling head caps laid out for comparison',
    },
    category: 'Migraines',
    tags: ['buying guide', 'migraines', 'comparison'],
    author: 'Icebrim Team',
    status: 'published',
    publishedAt: '2026-03-10',
    seo: {
      title: 'Best Cooling Cap for Migraines in the UK (2026) | Icebrim',
      description:
        'What to look for in a migraine cooling cap: fit, cold retention, and lifespan compared.',
    },
  },
  {
    id: 'post_hot_flush_night',
    slug: 'how-to-cool-down-hot-flushes-at-night',
    title: 'How to Cool Down Hot Flushes at Night: A Practical Guide',
    excerpt:
      'Waking up drenched at 3am is one of the most disruptive parts of perimenopause. Here\u2019s what actually helps, from layering your bedding to keeping a cooling accessory within reach.',
    contentHtml: `<p>Night sweats and hot flushes are among the most disruptive perimenopause symptoms. A few practical changes can make a real difference.</p>
<h2>Layer your bedding, don't bundle it</h2>
<p>Breathable, layered bedding you can kick off quickly beats one heavy duvet.</p>
<h2>Keep a cooling accessory within reach</h2>
<p>A cooling cap stored flat in the freezer means relief is seconds away rather than a trip downstairs for ice.</p>
<h2>Cool the room before you sleep</h2>
<p>A slightly cooler starting room temperature reduces the intensity of overnight flushes for many people.</p>`,
    featuredImage: {
      src: '/assets/blog/hot-flush-night.jpg',
      alt: 'A cool, calm bedroom setting with soft evening light',
    },
    category: 'Menopause',
    tags: ['menopause', 'sleep', 'hot flushes'],
    author: 'Icebrim Team',
    status: 'published',
    publishedAt: '2026-02-18',
    seo: {
      title: 'How to Cool Down Hot Flushes at Night | Icebrim',
      description:
        'Practical, evening-routine-friendly ways to manage night sweats and hot flushes.',
    },
  },
];
