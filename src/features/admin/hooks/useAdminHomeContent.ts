import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { HomePageContent } from '@/types/cms';
import { homeContent as seedHomeContent } from '@/data/home';

let localHomeContent = { ...seedHomeContent };

/**
 * Admin-side read of the full home page content blob (hero banner,
 * featured sections, etc). Used by pages like Banner that edit a slice
 * of this object and write the whole thing back with useUpdateHomeContent.
 */
export function useAdminHomeContent() {
  return useQuery<HomePageContent>({
    queryKey: ['admin', 'home'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/content/home') : Promise.resolve(localHomeContent)),
  });
}

export function useUpdateHomeContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HomePageContent) =>
      hasLiveApi
        ? api.put<HomePageContent>('/api/admin/content/home', input)
        : Promise.resolve((localHomeContent = { ...input })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'home'] });
      // Keep the public-facing home page content in sync too, so
      // banner/section edits show up immediately without a reload.
      qc.invalidateQueries({ queryKey: ['content', 'home'] });
    },
  });
}
