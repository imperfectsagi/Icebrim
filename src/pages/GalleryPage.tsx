import { Container, Eyebrow } from '@/components/ui/primitives';
import { SeoHead } from '@/components/common/SeoHead';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { useGalleryImages } from '@/hooks/useContent';

export default function GalleryPage() {
  const { data: images, isLoading } = useGalleryImages();

  if (isLoading) return <PageSkeleton />;

  return (
    <>
      <SeoHead
        seo={{
          title: 'Gallery | Icebrim',
          description: 'See the Icebrim Cooling Relief Cap in real settings.',
          canonicalPath: '/gallery',
        }}
      />

      <section className="py-16 md:py-20">
        <Container>
          <div className="max-w-xl mb-12">
            <Eyebrow>Gallery</Eyebrow>
            <h1 className="font-display text-4xl md:text-5xl font-medium text-balance">
              See Icebrim in real life
            </h1>
          </div>

          {(images ?? []).length === 0 ? (
            <p className="text-[var(--color-ink-soft)]">No images to show yet.</p>
          ) : (
            <div className="columns-2 md:columns-3 gap-4 [&>*]:mb-4">
              {(images ?? []).map((img) => (
                <figure key={img.id} className="rounded-[var(--radius-card)] overflow-hidden break-inside-avoid bg-[var(--color-surface)]">
                  <img src={img.src} alt={img.alt} loading="lazy" className="w-full h-auto object-cover" />
                  {img.caption && (
                    <figcaption className="p-3 text-sm text-[var(--color-ink-soft)]">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
