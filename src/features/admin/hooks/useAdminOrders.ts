import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { Order, OrderStatus, OrderStatusHistoryEntry } from '@/types/cms';

/**
 * Admin order hooks, following the same pattern as useAdminProducts.ts:
 * live API when VITE_API_BASE_URL is configured, otherwise an in-memory
 * local fallback so the admin panel is clickable in local development
 * without a deployed Worker + D1 backend.
 *
 * There's no seed-data file for orders (unlike products/blog/reviews)
 * because orders are inherently transactional records created by real
 * checkouts, not editorial content an admin would hand-author as sample
 * data -- an empty local list is the correct "no live backend" state.
 */
let localOrders: Order[] = [];

export function useAdminOrders(filters?: { status?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  const query = params.toString();

  return useQuery<Order[]>({
    queryKey: ['admin', 'orders', filters?.status ?? 'all', filters?.search ?? ''],
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/admin/orders${query ? `?${query}` : ''}`)
        : Promise.resolve(
            localOrders.filter((o) => {
              if (filters?.status && filters.status !== 'all' && o.status !== filters.status) return false;
              if (filters?.search) {
                const s = filters.search.toLowerCase();
                return (
                  o.orderNumber.toLowerCase().includes(s) ||
                  o.customer.email.toLowerCase().includes(s) ||
                  o.customer.name.toLowerCase().includes(s)
                );
              }
              return true;
            }),
          ),
  });
}

export function useAdminOrder(id: string | undefined) {
  return useQuery<Order & { history: OrderStatusHistoryEntry[] }>({
    queryKey: ['admin', 'orders', id],
    enabled: !!id,
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/admin/orders/${id}`)
        : Promise.resolve({ ...(localOrders.find((o) => o.id === id) as Order), history: [] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
      trackingNumber,
      trackingCarrier,
    }: {
      id: string;
      status: OrderStatus;
      note?: string;
      trackingNumber?: string;
      trackingCarrier?: string;
    }) =>
      hasLiveApi
        ? api.patch<Order>(`/api/admin/orders/${id}/status`, { status, note, trackingNumber, trackingCarrier })
        : Promise.resolve(
            (() => {
              localOrders = localOrders.map((o) => (o.id === id ? { ...o, status } : o));
              return localOrders.find((o) => o.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });
}

export function useUpdateOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote: string }) =>
      hasLiveApi
        ? api.patch<Order>(`/api/admin/orders/${id}/note`, { adminNote })
        : Promise.resolve(
            (() => {
              localOrders = localOrders.map((o) => (o.id === id ? { ...o, adminNote } : o));
              return localOrders.find((o) => o.id === id)!;
            })(),
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });
}
