import { Container } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { SeoHead } from '@/components/common/SeoHead';

export default function NotFoundPage() {
  return (
    <>
      <SeoHead
        seo={{ title: 'Page Not Found | Icebrim', description: 'This page could not be found.' }}
      />
      <section className="py-28 md:py-40">
        <Container className="text-center max-w-md">
          <p className="font-display text-7xl mb-4 text-[var(--color-coral)]">404</p>
          <h1 className="text-2xl font-medium mb-3">We couldn't find that page</h1>
          <p className="text-[var(--color-ink-soft)] mb-8">
            The page you're looking for may have moved or no longer exists.
          </p>
          <Button href="/">Back to home</Button>
        </Container>
      </section>
    </>
  );
}
