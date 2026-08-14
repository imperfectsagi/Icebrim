import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { Review } from '@/types/cms';
import { reviews as seedReviews } from '@/data/reviews';

let localReviews = [...seedReviews];

export function useAdminReviews() {
  return useQuery<Review[]>({
    queryKey: ['admin', 'reviews'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/reviews') : Promise.resolve(localReviews)),
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Review['status'] }) =>
      hasLiveApi
        ? api.patch<Review>(`/api/admin/reviews/${id}`, { status })
        : Promise.resolve(
            (() => {
              localReviews = localReviews.map((r) => (r.id === id ? { ...r, status } : r));
              return localReviews.find((r) => r.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export interface ReviewEditInput {
  authorName?: string;
  location?: string | null;
  rating?: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body?: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaSrc?: string | null;
  mediaImages?: string[];
}

export function useEditReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edits }: { id: string; edits: ReviewEditInput }) =>
      hasLiveApi
        ? api.put<Review>(`/api/admin/reviews/${id}`, edits)
        : Promise.resolve(
            (() => {
              localReviews = localReviews.map((r) =>
                r.id === id
                  ? {
                      ...r,
                      ...edits,
                      location: edits.location === null ? undefined : (edits.location ?? r.location),
                      mediaSrc: edits.mediaSrc === null ? undefined : (edits.mediaSrc ?? r.mediaSrc),
                    }
                  : r,
              );
              return localReviews.find((r) => r.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/reviews/${id}`)
        : Promise.resolve(
            (() => {
              localReviews = localReviews.filter((r) => r.id !== id);
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
