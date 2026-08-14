import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { PolicyPageContent, PolicyPageKey } from '@/types/cms';
import { policyPages as seedPolicyPages } from '@/data/policy';

// Local (non-live-API) fallback store, same pattern as
// useAdminHomeContent.ts's `localHomeContent` -- lets edits persist across
// admin navigation within a single session in local/offline preview mode,
// without needing a real backend.
const localPolicyPages: Record<PolicyPageKey, PolicyPageContent> = { ...seedPolicyPages };

export function useAdminPolicyPage(key: PolicyPageKey) {
  return useQuery<PolicyPageContent>({
    queryKey: ['admin', 'policy', key],
    queryFn: () =>
      hasLiveApi ? api.get(`/api/admin/content/policy/${key}`) : Promise.resolve(localPolicyPages[key]),
  });
}

export function useUpdatePolicyPage(key: PolicyPageKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PolicyPageContent) =>
      hasLiveApi
        ? api.put<PolicyPageContent>(`/api/admin/content/policy/${key}`, input)
        : Promise.resolve((localPolicyPages[key] = { ...input })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'policy', key] });
      // Keep the public-facing policy page in sync too, matching the
      // home/banner content pattern.
      qc.invalidateQueries({ queryKey: ['content', 'policy', key] });
    },
  });
}

export function useDeletePolicyPage(key: PolicyPageKey) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      hasLiveApi
        ? api.delete(`/api/admin/content/policy/${key}`)
        : Promise.resolve((localPolicyPages[key] = { title: localPolicyPages[key].title, contentHtml: '', updatedDateLabel: localPolicyPages[key].updatedDateLabel })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'policy', key] });
      qc.invalidateQueries({ queryKey: ['content', 'policy', key] });
    },
  });
}
