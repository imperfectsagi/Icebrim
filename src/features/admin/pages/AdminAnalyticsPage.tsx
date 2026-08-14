import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard } from '../components/AdminUi';
import { api, hasLiveApi } from '@/lib/api-client';

interface AnalyticsSummary {
  visitors30d: number;
  pageviews30d: number;
  topPages: { path: string; views: number }[];
  topReferrers: { source: string; visits: number }[];
}

export function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsSummary>({
    queryKey: ['admin', 'analytics'],
    queryFn: () =>
      hasLiveApi
        ? api.get('/api/admin/analytics/summary')
        : Promise.resolve({ visitors30d: 0, pageviews30d: 0, topPages: [], topReferrers: [] }),
  });

  return (
    <div>
      <AdminPageHeader title="Analytics" description="Traffic overview for the last 30 days." />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : !hasLiveApi ? (
        <AdminCard>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Analytics data will appear here once connected to Cloudflare Web Analytics or the
            Worker's own analytics endpoint. Configure <code>VITE_API_BASE_URL</code> to connect a
            live backend.
          </p>
        </AdminCard>
      ) : (
        <div className="grid sm:grid-cols-2 gap-6">
          <AdminCard>
            <p className="text-2xl font-semibold">{data?.visitors30d}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">Visitors (30 days)</p>
          </AdminCard>
          <AdminCard>
            <p className="text-2xl font-semibold">{data?.pageviews30d}</p>
            <p className="text-xs text-[var(--color-ink-soft)]">Pageviews (30 days)</p>
          </AdminCard>
        </div>
      )}
    </div>
  );
}
