import { useQuery } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';

export interface DashboardStats {
  totalProducts: number;
  totalBlogs: number;
  totalReviews: number;
  pendingReviews: number;
  visitors30d: number;
  unreadMessages: number;
  recentActivity: { id: string; label: string; timestamp: string }[];
}

const FALLBACK_STATS: DashboardStats = {
  totalProducts: 2,
  totalBlogs: 3,
  totalReviews: 3,
  pendingReviews: 0,
  visitors30d: 0,
  unreadMessages: 0,
  recentActivity: [],
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: () =>
      hasLiveApi ? api.get('/api/admin/dashboard/stats') : Promise.resolve(FALLBACK_STATS),
    staleTime: 30 * 1000,
  });
}
