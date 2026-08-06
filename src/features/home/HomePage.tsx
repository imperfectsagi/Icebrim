import { useHomeContent } from '@/hooks/useContent';
import { HeroBanner } from '@/components/sections/HeroBanner';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { WhyChooseUs } from '@/components/sections/WhyChooseUs';
import { FeaturedProducts } from '@/components/sections/FeaturedProducts';
import { AboutSection } from '@/components/sections/AboutSection';
import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { BlogSection } from '@/components/sections/BlogSection';
import { CtaSection } from '@/components/sections/CtaSection';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';

export default function HomePage() {
  const { data: content, isLoading } = useHomeContent();

  if (isLoading || !content) return <PageSkeleton />;

  return (
    <>
      <SeoHead seo={content.seo} />
      <HeroBanner content={content.hero} />
      <HowItWorks content={content.howItWorks} />
      <WhyChooseUs content={content.whyChooseUs} />
      <FeaturedProducts content={content.featuredProducts} />
      <AboutSection content={content.about} />
      <ReviewsSection content={content.reviews} />
      <BlogSection content={content.blog} />
      <CtaSection content={content.cta} />
    </>
  );
}
