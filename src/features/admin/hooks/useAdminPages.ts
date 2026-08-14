import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { CmsPage } from '@/types/cms';

// No local seed data for custom pages -- this feature doesn't exist in the
// pre-live-API version of the app (see src/data/*.ts, which has no
// equivalent). The offline/local-dev fallback is simply an empty,
// in-memory list, same shape as every other admin CRUD hook in this
// directory so the module still works standalone before a backend is
// configured, it just starts with nothing to manage.
let localPages: CmsPage[] = [];

export function useAdminPages() {
  return useQuery<CmsPage[]>({
    queryKey: ['admin', 'pages'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/pages') : Promise.resolve(localPages)),
  });
}

export function useAdminPage(id: string | undefined) {
  return useQuery<CmsPage>({
    queryKey: ['admin', 'pages', id],
    enabled: !!id,
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/admin/pages/${id}`)
        : Promise.resolve(localPages.find((p) => p.id === id)!),
  });
}

export type PageInput = Omit<CmsPage, 'id' | 'createdAt' | 'updatedAt'>;

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PageInput) =>
      hasLiveApi
        ? api.post<CmsPage>('/api/admin/pages', input)
        : Promise.resolve(
            (() => {
              const now = new Date().toISOString();
              const created: CmsPage = { ...input, id: `page_${crypto.randomUUID()}`, createdAt: now, updatedAt: now };
              localPages = [...localPages, created];
              return created;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
    },
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<PageInput> & { id: string }) =>
      hasLiveApi
        ? api.put<CmsPage>(`/api/admin/pages/${id}`, input)
        : Promise.resolve(
            (() => {
              localPages = localPages.map((p) =>
                p.id === id ? { ...p, ...input, updatedAt: new Date().toISOString() } : p,
              );
              return localPages.find((p) => p.id === id)!;
            })(),
          ),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
      qc.invalidateQueries({ queryKey: ['admin', 'pages', variables.id] });
    },
  });
}

/** One-click publish/unpublish -- see PATCH /api/admin/pages/:id/status. */
export function useSetPageStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'draft' | 'published' }) =>
      hasLiveApi
        ? api.patch<CmsPage>(`/api/admin/pages/${id}/status`, { status })
        : Promise.resolve(
            (() => {
              localPages = localPages.map((p) =>
                p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p,
              );
              return localPages.find((p) => p.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/pages/${id}`)
        : Promise.resolve(
            (() => {
              localPages = localPages.filter((p) => p.id !== id);
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'pages'] });
    },
  });
}
