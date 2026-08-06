import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { GalleryImage } from '@/types/cms';

/**
 * Admin gallery data hooks. Mirrors the pattern used by useAdminReviews /
 * useAdminProducts -- falls back to an in-memory local list when no live
 * backend is configured, so the admin UI stays clickable during local dev.
 */

let localGallery: GalleryImage[] = [
  {
    id: 'g1',
    src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
    alt: 'Icebrim Cooling Relief Cap in use at home',
    category: 'Lifestyle',
  },
  {
    id: 'g2',
    src: '/assets/products/twin-pack/hero.jpg',
    alt: 'Icebrim Rotation Twin Pack packaging',
    category: 'Product',
  },
];

export function useAdminGallery() {
  return useQuery<GalleryImage[]>({
    queryKey: ['admin', 'gallery'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/gallery') : Promise.resolve(localGallery)),
  });
}

export interface GalleryImageInput {
  src: string;
  alt: string;
  caption?: string;
  category?: string;
  mediaType?: 'image' | 'video' | 'gif';
  videoSrc?: string;
}

export function useCreateGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GalleryImageInput) =>
      hasLiveApi
        ? api.post<GalleryImage>('/api/admin/gallery', input)
        : Promise.resolve(
            (() => {
              const created: GalleryImage = { id: `gal_${crypto.randomUUID()}`, ...input };
              localGallery = [...localGallery, created];
              return created;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      qc.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

export interface GalleryImagePatchInput {
  src?: string;
  alt?: string;
  caption?: string | null;
  category?: string | null;
  mediaType?: 'image' | 'video' | 'gif';
  videoSrc?: string | null;
}

export function useEditGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edits }: { id: string; edits: GalleryImagePatchInput }) =>
      hasLiveApi
        ? api.patch<GalleryImage>(`/api/admin/gallery/${id}`, edits)
        : Promise.resolve(
            (() => {
              localGallery = localGallery.map((img) =>
                img.id === id
                  ? {
                      ...img,
                      ...edits,
                      caption: edits.caption === null ? undefined : (edits.caption ?? img.caption),
                      category: edits.category === null ? undefined : (edits.category ?? img.category),
                      videoSrc: edits.videoSrc === null ? undefined : (edits.videoSrc ?? img.videoSrc),
                    }
                  : img,
              );
              return localGallery.find((img) => img.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      qc.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

export function useDeleteGalleryImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/gallery/${id}`)
        : Promise.resolve((localGallery = localGallery.filter((img) => img.id !== id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      qc.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}

export function useReorderGalleryImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      hasLiveApi
        ? api.put<GalleryImage[]>('/api/admin/gallery/reorder', { orderedIds })
        : Promise.resolve(
            (() => {
              const byId = new Map(localGallery.map((img) => [img.id, img]));
              localGallery = orderedIds.map((id) => byId.get(id)).filter(Boolean) as GalleryImage[];
              return localGallery;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gallery'] });
      qc.invalidateQueries({ queryKey: ['gallery'] });
    },
  });
}
