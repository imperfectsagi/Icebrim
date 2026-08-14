import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '../components/AdminUi';
import { DataTable } from '../components/DataTable';
import { Badge } from '@/components/ui/primitives';
import { useAdminBlogPosts, useDeleteBlogPost } from '../hooks/useAdminBlog';
import { formatDate } from '@/lib/utils';

export function AdminBlogsPage() {
  const { data: posts, isLoading } = useAdminBlogPosts();
  const deletePost = useDeleteBlogPost();
  const navigate = useNavigate();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div>
      <AdminPageHeader
        title="Blogs"
        description="Write and manage blog posts."
        action={{ label: 'Add Blog Post', onClick: () => navigate('/admin/blogs/new') }}
      />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={posts ?? []}
          emptyMessage="No blog posts yet."
          columns={[
            { header: 'Title', accessor: (p) => <span className="font-medium">{p.title}</span> },
            { header: 'Category', accessor: (p) => p.category },
            {
              header: 'Status',
              accessor: (p) => (
                <Badge tone={p.status === 'published' ? 'ice' : 'coral'}>
                  {p.status === 'published' ? 'Published' : 'Draft'}
                </Badge>
              ),
            },
            { header: 'Date', accessor: (p) => formatDate(p.publishedAt) },
          ]}
          rowActions={(p) => (
            <div className="flex items-center gap-1 justify-end">
              <button
                onClick={() => navigate(`/admin/blogs/${p.id}`)}
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
            <h2 className="font-semibold mb-2">Delete this post?</h2>
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
                  deletePost.mutate(confirmId);
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
