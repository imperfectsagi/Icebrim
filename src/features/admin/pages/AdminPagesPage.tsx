import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, ExternalLink } from 'lucide-react';
import { AdminPageHeader } from '../components/AdminUi';
import { DataTable } from '../components/DataTable';
import { Badge } from '@/components/ui/primitives';
import { useAdminPages, useDeletePage, useSetPageStatus } from '../hooks/useAdminPages';
import { formatDate } from '@/lib/utils';

export function AdminPagesPage() {
  const { data: pages, isLoading } = useAdminPages();
  const deletePage = useDeletePage();
  const setStatus = useSetPageStatus();
  const navigate = useNavigate();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div>
      <AdminPageHeader
        title="Pages"
        description="Manage standalone pages -- built-in pages like About, plus any custom pages you add (e.g. FAQ, shipping info). Each is published at its own URL, e.g. /about or /faq."
        action={{ label: 'Add Page', onClick: () => navigate('/admin/pages/new') }}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={pages ?? []}
          emptyMessage="No pages yet. Add one to publish standalone content like FAQs or shipping info."
          columns={[
            {
              header: 'Title',
              accessor: (p) => (
                <span className="font-medium inline-flex items-center gap-2">
                  {p.title}
                  {p.isSystem && <Badge tone="ice">Built-in</Badge>}
                </span>
              ),
            },
            {
              header: 'URL',
              accessor: (p) => <span className="font-mono text-xs text-[var(--color-ink-soft)]">/{p.slug}</span>,
            },
            {
              header: 'Status',
              accessor: (p) => (
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: p.id, status: p.status === 'published' ? 'draft' : 'published' })}
                  disabled={setStatus.isPending}
                  title={
                    p.status === 'published'
                      ? `Click to disable -- /${p.slug} will show a not-found page`
                      : `Click to enable -- publishes at /${p.slug}`
                  }
                >
                  <Badge tone={p.status === 'published' ? 'ice' : 'coral'}>
                    {p.status === 'published' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </button>
              ),
            },
            { header: 'Updated', accessor: (p) => formatDate(p.updatedAt) },
          ]}
          rowActions={(p) => (
            <div className="flex items-center gap-1 justify-end">
              {p.status === 'published' && (
                <a
                  href={`/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${p.title}`}
                  className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                onClick={() => navigate(`/admin/pages/${p.id}`)}
                aria-label={`Edit ${p.title}`}
                className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
              >
                <Pencil size={15} />
              </button>
              {!p.isSystem && (
                <button
                  onClick={() => setConfirmId(p.id)}
                  aria-label={`Delete ${p.title}`}
                  className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          )}
        />
      )}

      {confirmId && (
        <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[var(--radius-card)] p-6 max-w-sm w-full">
            <h2 className="font-semibold mb-2">Delete this page?</h2>
            <p className="text-sm text-[var(--color-ink-soft)] mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="px-4 py-2 rounded-full text-sm font-medium border border-[var(--color-line)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deletePage.mutate(confirmId);
                  setConfirmId(null);
                }}
                className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-coral-deep)] text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
