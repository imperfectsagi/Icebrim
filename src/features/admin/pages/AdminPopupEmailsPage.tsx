import { AdminPageHeader } from '../components/AdminUi';
import { DataTable } from '../components/DataTable';
import { useAdminPopupEmails } from '../hooks/useAdminPopupOffer';
import { formatDate } from '@/lib/utils';

/**
 * Requirement #2: shows exactly the three fields asked for -- email,
 * submission date/time, and the coupon/offer shown to that customer --
 * and nothing else. No CRM, campaigns, or analytics; a read-only list,
 * same DataTable component/shape already used by AdminCouponsPage.tsx.
 */
export function AdminPopupEmailsPage() {
  const { data: emails, isLoading } = useAdminPopupEmails();

  return (
    <div>
      <AdminPageHeader
        title="Popup Emails"
        description="Emails submitted through the offer popup, and the coupon shown to each."
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={emails ?? []}
          emptyMessage="No submissions yet."
          columns={[
            { header: 'Email', accessor: (e) => e.email },
            {
              header: 'Coupon shown',
              accessor: (e) => (e.couponCode ? <span className="font-mono">{e.couponCode}</span> : '—'),
            },
            { header: 'Submitted', accessor: (e) => formatDate(e.createdAt) },
          ]}
        />
      )}
    </div>
  );
}
