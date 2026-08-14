import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { BlogPost } from '@/types/cms';
import { blogPosts as seedBlogPosts } from '@/data/blog';

let localPosts = [...seedBlogPosts];

export function useAdminBlogPosts() {
  return useQuery<BlogPost[]>({
    queryKey: ['admin', 'blog'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/blog') : Promise.resolve(localPosts)),
  });
}

export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BlogPost, 'id'>) =>
      hasLiveApi
        ? api.post<BlogPost>('/api/admin/blog', input)
        : Promise.resolve(
            (() => {
              const created: BlogPost = { ...input, id: `post_${crypto.randomUUID()}` };
              localPosts = [...localPosts, created];
              return created;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
    },
  });
}

export function useUpdateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<BlogPost> & { id: string }) =>
      hasLiveApi
        ? api.put<BlogPost>(`/api/admin/blog/${id}`, input)
        : Promise.resolve(
            (() => {
              localPosts = localPosts.map((p) => (p.id === id ? { ...p, ...input } : p));
              return localPosts.find((p) => p.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
    },
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/blog/${id}`)
        : Promise.resolve(
            (() => {
              localPosts = localPosts.filter((p) => p.id !== id);
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'blog'] });
      qc.invalidateQueries({ queryKey: ['blog'] });
    },
  });
}
