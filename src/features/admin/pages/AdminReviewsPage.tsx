import { useState } from 'react';
import { Check, X, Trash2, Pencil, Star } from 'lucide-react';
import { AdminPageHeader, FormRow } from '../components/AdminUi';
import { AdminModal } from '../components/AdminModal';
import { DataTable } from '../components/DataTable';
import { ImageUploadField } from '../components/ImageUploadField';
import { Badge } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { useAdminReviews, useModerateReview, useDeleteReview, useEditReview } from '../hooks/useAdminReviews';
import { formatDate } from '@/lib/utils';
import type { Review } from '@/types/cms';

const STATUS_TONE: Record<Review['status'], 'ice' | 'coral'> = {
  approved: 'ice',
  pending: 'coral',
  rejected: 'coral',
};

interface ReviewEditFormState {
  authorName: string;
  location: string;
  rating: number;
  title: string;
  body: string;
  mediaType: 'none' | 'image' | 'video';
  mediaSrc: string;
}

function toStarRating(n: number): 1 | 2 | 3 | 4 | 5 {
  const clamped = Math.min(5, Math.max(1, Math.round(n)));
  return clamped as 1 | 2 | 3 | 4 | 5;
}

function EditableStarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            size={22}
            className={n <= value ? 'fill-[var(--color-coral)] text-[var(--color-coral)]' : 'text-[var(--color-line)]'}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

export function AdminReviewsPage() {
  const { data: reviews, isLoading } = useAdminReviews();
  const moderate = useModerateReview();
  const deleteReview = useDeleteReview();
  const editReview = useEditReview();

  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editForm, setEditForm] = useState<ReviewEditFormState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (review: Review) => {
    setEditingReview(review);
    setEditForm({
      authorName: review.authorName,
      location: review.location ?? '',
      rating: review.rating,
      title: review.title,
      body: review.body,
      mediaType: review.mediaType ?? 'none',
      mediaSrc: review.mediaSrc ?? '',
    });
    setEditError(null);
  };

  const closeEdit = () => {
    setEditingReview(null);
    setEditForm(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview || !editForm) return;
    setEditError(null);

    if (editForm.authorName.trim().length < 2) {
      setEditError('Author name is too short.');
      return;
    }
    if (editForm.title.trim().length < 3) {
      setEditError('Title is too short.');
      return;
    }
    if (editForm.body.trim().length < 10) {
      setEditError('Review text is too short.');
      return;
    }

    editReview.mutate(
      {
        id: editingReview.id,
        edits: {
          authorName: editForm.authorName.trim(),
          location: editForm.location.trim() || null,
          rating: toStarRating(editForm.rating),
          title: editForm.title.trim(),
          body: editForm.body.trim(),
          mediaType: editForm.mediaType,
          mediaSrc: editForm.mediaType === 'none' ? null : editForm.mediaSrc || null,
        },
      },
      {
        onSuccess: closeEdit,
        onError: (err) => setEditError(err instanceof Error ? err.message : 'Failed to save changes.'),
      },
    );
  };

  return (
    <div>
      <AdminPageHeader title="Reviews" description="Approve, reject, edit, or remove customer reviews." />

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (
        <DataTable
          rows={reviews ?? []}
          emptyMessage="No reviews submitted yet."
          columns={[
            {
              header: 'Review',
              accessor: (r) => (
                <div className="max-w-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating value={r.rating} size={13} />
                    <span className="font-medium text-sm">{r.title}</span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-soft)] line-clamp-2">{r.body}</p>
                </div>
              ),
            },
            { header: 'Author', accessor: (r) => r.authorName },
            { header: 'Product', accessor: (r) => r.productSlug },
            { header: 'Date', accessor: (r) => formatDate(r.createdAt) },
            {
              header: 'Status',
              accessor: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
            },
          ]}
          rowActions={(r) => (
            <div className="flex items-center gap-1 justify-end">
              {r.status !== 'approved' && (
                <button
                  onClick={() => moderate.mutate({ id: r.id, status: 'approved' })}
                  aria-label="Approve review"
                  className="p-2 rounded-lg hover:bg-[var(--color-ice)]"
                >
                  <Check size={15} />
                </button>
              )}
              {r.status !== 'rejected' && (
                <button
                  onClick={() => moderate.mutate({ id: r.id, status: 'rejected' })}
                  aria-label="Reject review"
                  className="p-2 rounded-lg hover:bg-[var(--color-surface)]"
                >
                  <X size={15} />
                </button>
              )}
              <button
                onClick={() => openEdit(r)}
                aria-label="Edit review"
                className="p-2 rounded-lg hover:bg-[var(--color-surface-alt)]"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => deleteReview.mutate(r.id)}
                aria-label="Delete review"
                className="p-2 rounded-lg hover:bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        />
      )}

      {editingReview && editForm && (
        <AdminModal title="Edit review" onClose={closeEdit}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormRow label="Rating">
              <EditableStarRating
                value={editForm.rating}
                onChange={(rating) => setEditForm((f) => (f ? { ...f, rating } : f))}
              />
            </FormRow>
            <FormRow label="Author name">
              <input
                className="form-input"
                value={editForm.authorName}
                onChange={(e) => setEditForm((f) => (f ? { ...f, authorName: e.target.value } : f))}
              />
            </FormRow>
            <FormRow label="Location (optional)">
              <input
                className="form-input"
                value={editForm.location}
                onChange={(e) => setEditForm((f) => (f ? { ...f, location: e.target.value } : f))}
              />
            </FormRow>
            <FormRow label="Title">
              <input
                className="form-input"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => (f ? { ...f, title: e.target.value } : f))}
              />
            </FormRow>
            <FormRow label="Review text">
              <textarea
                className="form-input"
                rows={5}
                value={editForm.body}
                onChange={(e) => setEditForm((f) => (f ? { ...f, body: e.target.value } : f))}
              />
            </FormRow>
            <FormRow label="Attached photo or video (optional)">
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  {(['none', 'image', 'video'] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={editForm.mediaType === opt}
                        onChange={() => setEditForm((f) => (f ? { ...f, mediaType: opt } : f))}
                        className="h-3.5 w-3.5"
                      />
                      {opt === 'none' ? 'None' : opt === 'image' ? 'Photo' : 'Video'}
                    </label>
                  ))}
                </div>
                {editForm.mediaType !== 'none' && (
                  <ImageUploadField
                    accept="image+video"
                    mediaType={editForm.mediaType === 'video' ? 'video' : 'image'}
                    value={editForm.mediaSrc}
                    onChange={(mediaSrc) => setEditForm((f) => (f ? { ...f, mediaSrc } : f))}
                  />
                )}
              </div>
            </FormRow>
            {editError && (
              <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                {editError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={editReview.isPending}>
                {editReview.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={closeEdit}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
