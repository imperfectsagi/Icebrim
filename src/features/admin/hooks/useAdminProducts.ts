import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { Product } from '@/types/cms';
import { products as seedProducts } from '@/data/products';

/**
 * Admin product hooks
 * --------------------
 * These call the same /api/products endpoints as the public site's
 * useProducts/useProduct hooks, but the Worker enforces that write
 * operations (POST/PUT/DELETE) require an authenticated admin session
 * via the HttpOnly cookie -- the frontend never needs to attach a token
 * manually because `credentials: 'include'` is set in api-client.ts.
 *
 * When no live API is configured, mutations operate on an in-memory copy
 * of the seed data so the admin UI is fully clickable in local development.
 */

let localProducts = [...seedProducts];

export function useAdminProducts() {
  return useQuery<Product[]>({
    queryKey: ['admin', 'products'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/products') : Promise.resolve(localProducts)),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Product, 'id'>) =>
      hasLiveApi
        ? api.post<Product>('/api/admin/products', input)
        : Promise.resolve(
            (() => {
              const created: Product = { ...input, id: `prod_${crypto.randomUUID()}` };
              localProducts = [...localProducts, created];
              return created;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<Product> & { id: string }) =>
      hasLiveApi
        ? api.put<Product>(`/api/admin/products/${id}`, input)
        : Promise.resolve(
            (() => {
              localProducts = localProducts.map((p) => (p.id === id ? { ...p, ...input } : p));
              return localProducts.find((p) => p.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/products/${id}`)
        : Promise.resolve(
            (() => {
              localProducts = localProducts.filter((p) => p.id !== id);
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
