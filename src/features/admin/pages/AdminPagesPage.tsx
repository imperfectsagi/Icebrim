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
        description="Create and manage standalone pages (e.g. FAQs, shipping info) published at /pages/:slug."
        action={{ label: 'Add Page', onClick: () => navigate('/admin/pages/new') }}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={pages ?? []}
          emptyMessage="No pages yet. Add one to publish standalone content like FAQs or shipping info."
          columns={[
            { header: 'Title', accessor: (p) => <span className="font-medium">{p.title}</span> },
            {
              header: 'Slug',
              accessor: (p) => <span className="font-mono text-xs text-[var(--color-ink-soft)]">/pages/{p.slug}</span>,
            },
            {
              header: 'Status',
              accessor: (p) => (
                <button
                  type="button"
                  onClick={() => setStatus.mutate({ id: p.id, status: p.status === 'published' ? 'draft' : 'published' })}
                  disabled={setStatus.isPending}
                  title={p.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                >
                  <Badge tone={p.status === 'published' ? 'ice' : 'coral'}>
                    {p.status === 'published' ? 'Published' : 'Draft'}
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
                  href={`/pages/${p.slug}`}
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
              <button
                onClick={() => setConfirmId(p.id)}
                aria-label={`Delete ${p.title}`}
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
              >
                <Trash2 size={15} />
              </button>
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
