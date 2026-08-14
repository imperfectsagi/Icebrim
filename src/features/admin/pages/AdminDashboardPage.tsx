import { Package, FileText, Star, Users, Mail, Activity, AlertTriangle } from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { cn } from '@/lib/utils';

const STAT_CARDS = [
  { key: 'totalProducts', label: 'Total Products', icon: Package },
  { key: 'totalBlogs', label: 'Total Blogs', icon: FileText },
  { key: 'totalReviews', label: 'Total Reviews', icon: Star },
  { key: 'visitors30d', label: 'Visitors (30d)', icon: Users },
  { key: 'unreadMessages', label: 'Unread Messages', icon: Mail },
] as const;

export function AdminDashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const hasPaymentErrors = !isLoading && (stats?.paymentErrors24h ?? 0) > 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-medium mb-1">Dashboard</h1>
      <p className="text-sm text-[var(--color-ink-soft)] mb-8">
        An overview of your site's content and activity.
      </p>

      {hasPaymentErrors && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 text-red-800 px-4 py-3 mb-6"
        >
          <AlertTriangle size={18} aria-hidden="true" />
          <p className="text-sm font-medium">
            {stats!.paymentErrors24h} payment or webhook error{stats!.paymentErrors24h === 1 ? '' : 's'} in the last
            24 hours. This can mean orders aren't being confirmed correctly — check your Stripe/Razorpay webhook
            configuration (see DEPLOYMENT.md §6).
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-5"
          >
            <div className="h-9 w-9 rounded-full bg-[var(--color-coral-tint)] flex items-center justify-center mb-3">
              <card.icon size={16} className="text-[var(--color-coral-deep)]" aria-hidden="true" />
            </div>
            <p
              className={cn(
                'text-2xl font-semibold',
                isLoading && 'animate-pulse text-[var(--color-line)]',
              )}
            >
              {isLoading ? '—' : stats?.[card.key]}
            </p>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[var(--color-coral-deep)]" aria-hidden="true" />
          <h2 className="font-semibold">Recent Activity</h2>
        </div>
        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
          <ul className="divide-y divide-[var(--color-line)]">
            {stats.recentActivity.map((item) => (
              <li key={item.id} className="py-3 text-sm flex justify-between">
                <span>{item.label}</span>
                <span className="text-[var(--color-ink-soft)]">{item.timestamp}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">No recent activity yet.</p>
        )}
      </div>
    </div>
  );
}
