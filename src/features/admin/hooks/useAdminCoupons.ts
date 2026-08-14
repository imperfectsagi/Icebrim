import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { Coupon } from '@/types/cms';

/**
 * Admin coupon hooks, same live-API-or-local-fallback pattern as
 * useAdminOrders.ts. No seed-data file, for the same reason orders don't
 * have one -- coupons are operational/commerce configuration an admin
 * creates for real, not editorial sample content.
 */
let localCoupons: Coupon[] = [];

export function useAdminCoupons() {
  return useQuery<Coupon[]>({
    queryKey: ['admin', 'coupons'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/coupons') : Promise.resolve(localCoupons)),
  });
}

export type CouponInput = {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  active: boolean;
  expiresAt?: string | null;
  usageLimit?: number | null;
  minOrderSubtotal?: number | null;
};

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CouponInput) =>
      hasLiveApi
        ? api.post<Coupon>('/api/admin/coupons', input)
        : Promise.resolve(
            (() => {
              const coupon: Coupon = {
                id: `local_${crypto.randomUUID()}`,
                code: input.code.toUpperCase(),
                discountType: input.discountType,
                discountValue: input.discountValue,
                active: input.active,
                expiresAt: input.expiresAt ?? null,
                usageLimit: input.usageLimit ?? null,
                usedCount: 0,
                minOrderSubtotal: input.minOrderSubtotal ?? null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              localCoupons = [coupon, ...localCoupons];
              return coupon;
            })(),
          ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CouponInput & { id: string }) =>
      hasLiveApi
        ? api.put<Coupon>(`/api/admin/coupons/${id}`, input)
        : Promise.resolve(
            (() => {
              localCoupons = localCoupons.map((c) =>
                c.id === id
                  ? { ...c, ...input, code: input.code.toUpperCase(), updatedAt: new Date().toISOString() }
                  : c,
              );
              return localCoupons.find((c) => c.id === id)!;
            })(),
          ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      hasLiveApi
        ? api.delete(`/api/admin/coupons/${id}`)
        : Promise.resolve((localCoupons = localCoupons.filter((c) => c.id !== id))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}
