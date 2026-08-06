import { useState } from 'react';
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Film } from 'lucide-react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { AdminModal } from '../components/AdminModal';
import { ImageUploadField } from '../components/ImageUploadField';
import { Button } from '@/components/ui/Button';
import {
  useAdminGallery,
  useCreateGalleryImage,
  useEditGalleryImage,
  useDeleteGalleryImage,
  useReorderGalleryImages,
} from '../hooks/useAdminGallery';
import type { GalleryImage } from '@/types/cms';

interface GalleryFormState {
  mediaType: 'image' | 'video' | 'gif';
  src: string;
  videoSrc: string;
  alt: string;
  caption: string;
  category: string;
}

const EMPTY_FORM: GalleryFormState = { mediaType: 'image', src: '', videoSrc: '', alt: '', caption: '', category: '' };

function MediaTypeToggle({
  value,
  onChange,
}: {
  value: GalleryFormState['mediaType'];
  onChange: (v: GalleryFormState['mediaType']) => void;
}) {
  return (
    <div className="flex items-center gap-4 text-sm">
      {(['image', 'video', 'gif'] as const).map((opt) => (
        <label key={opt} className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="h-3.5 w-3.5"
          />
          {opt === 'image' ? 'Image' : opt === 'video' ? 'Video' : 'GIF'}
        </label>
      ))}
    </div>
  );
}

export function AdminGalleryPage() {
  const { data: images, isLoading } = useAdminGallery();
  const createImage = useCreateGalleryImage();
  const editImage = useEditGalleryImage();
  const deleteImage = useDeleteGalleryImage();
  const reorderImages = useReorderGalleryImages();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<GalleryFormState>(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [editForm, setEditForm] = useState<GalleryFormState>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const list = images ?? [];

  const openEdit = (img: GalleryImage) => {
    setEditingImage(img);
    setEditForm({
      mediaType: img.mediaType ?? 'image',
      src: img.src,
      videoSrc: img.videoSrc ?? '',
      alt: img.alt,
      caption: img.caption ?? '',
      category: img.category ?? '',
    });
    setEditError(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    const usingVideo = addForm.mediaType === 'video';
    if (usingVideo ? !addForm.videoSrc : !addForm.src) {
      setAddError(`Upload a ${addForm.mediaType} first.`);
      return;
    }
    if (!addForm.alt.trim()) {
      setAddError('Alt text is required so this entry is accessible and SEO-friendly.');
      return;
    }
    createImage.mutate(
      {
        src: addForm.src,
        alt: addForm.alt.trim(),
        caption: addForm.caption.trim() || undefined,
        category: addForm.category.trim() || undefined,
        mediaType: addForm.mediaType,
        videoSrc: usingVideo ? addForm.videoSrc : undefined,
      },
      {
        onSuccess: () => {
          setAddForm(EMPTY_FORM);
          setShowAddForm(false);
        },
        onError: (err) => setAddError(err instanceof Error ? err.message : 'Failed to add gallery entry.'),
      },
    );
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;
    setEditError(null);
    const usingVideo = editForm.mediaType === 'video';
    if (usingVideo ? !editForm.videoSrc : !editForm.src) {
      setEditError(`A ${editForm.mediaType} is required.`);
      return;
    }
    if (!editForm.alt.trim()) {
      setEditError('Alt text is required.');
      return;
    }
    editImage.mutate(
      {
        id: editingImage.id,
        edits: {
          src: editForm.src,
          alt: editForm.alt.trim(),
          caption: editForm.caption.trim() || null,
          category: editForm.category.trim() || null,
          mediaType: editForm.mediaType,
          videoSrc: usingVideo ? editForm.videoSrc : null,
        },
      },
      {
        onSuccess: () => setEditingImage(null),
        onError: (err) => setEditError(err instanceof Error ? err.message : 'Failed to save changes.'),
      },
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderImages.mutate(reordered.map((img) => img.id));
  };

  return (
    <div>
      <AdminPageHeader
        title="Gallery"
        description="Manage the images, GIFs, and videos shown on the public Gallery page. Use the arrows to reorder."
        action={{ label: 'Add Media', onClick: () => setShowAddForm((v) => !v) }}
      />

      {showAddForm && (
        <AdminCard className="max-w-xl mb-6">
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <FormRow label="Media type">
              <MediaTypeToggle
                value={addForm.mediaType}
                onChange={(mediaType) => setAddForm((f) => ({ ...f, mediaType }))}
              />
            </FormRow>
            <FormRow label={addForm.mediaType === 'video' ? 'Video' : addForm.mediaType === 'gif' ? 'GIF' : 'Image'}>
              {addForm.mediaType === 'video' ? (
                <ImageUploadField
                  accept="image+video"
                  mediaType="video"
                  value={addForm.videoSrc}
                  onChange={(videoSrc) => setAddForm((f) => ({ ...f, videoSrc }))}
                />
              ) : (
                <ImageUploadField
                  accept="image+video"
                  mediaType={addForm.mediaType === 'gif' ? 'gif' : 'image'}
                  value={addForm.src}
                  onChange={(src) => setAddForm((f) => ({ ...f, src }))}
                />
              )}
            </FormRow>
            {addForm.mediaType === 'video' && (
              <FormRow label="Poster image (optional)" hint="Shown before the video is played/loaded.">
                <ImageUploadField value={addForm.src} onChange={(src) => setAddForm((f) => ({ ...f, src }))} />
              </FormRow>
            )}
            <FormRow label="Alt text" hint="Describes the media for accessibility and SEO.">
              <input
                className="form-input"
                value={addForm.alt}
                onChange={(e) => setAddForm((f) => ({ ...f, alt: e.target.value }))}
                placeholder="e.g. Icebrim Cooling Relief Cap in use at home"
              />
            </FormRow>
            <FormRow label="Caption (optional)">
              <input
                className="form-input"
                value={addForm.caption}
                onChange={(e) => setAddForm((f) => ({ ...f, caption: e.target.value }))}
              />
            </FormRow>
            <FormRow label="Category (optional)">
              <input
                className="form-input"
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Lifestyle, Product"
              />
            </FormRow>
            {addError && (
              <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                {addError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={createImage.isPending}>
                <Plus size={15} /> {createImage.isPending ? 'Adding…' : 'Add to gallery'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setAddForm(EMPTY_FORM);
                  setAddError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </AdminCard>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] p-12 text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Nothing in the gallery yet. Click "Add Media" to upload your first image, GIF, or video.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {list.map((img, index) => (
            <div
              key={img.id}
              className="group relative rounded-lg overflow-hidden border border-[var(--color-line)] bg-white"
            >
              <div className="aspect-square bg-[var(--color-surface)] relative">
                <img src={img.src} alt={img.alt} loading="lazy" className="h-full w-full object-cover" />
                {img.mediaType === 'video' && (
                  <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white rounded p-1" aria-hidden="true">
                    <Film size={12} />
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium truncate">{img.caption || img.alt}</p>
                {img.category && (
                  <p className="text-[10px] text-[var(--color-ink-soft)] uppercase tracking-wide mt-0.5">
                    {img.category}
                  </p>
                )}
              </div>

              <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(img)}
                  aria-label={`Edit ${img.alt}`}
                  className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => deleteImage.mutate(img.id)}
                  aria-label={`Delete ${img.alt}`}
                  className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[var(--color-coral-deep)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                  className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-40"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => move(index, 1)}
                  disabled={index === list.length - 1}
                  aria-label="Move later"
                  className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-40"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingImage && (
        <AdminModal title="Edit gallery entry" onClose={() => setEditingImage(null)}>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormRow label="Media type">
              <MediaTypeToggle
                value={editForm.mediaType}
                onChange={(mediaType) => setEditForm((f) => ({ ...f, mediaType }))}
              />
            </FormRow>
            <FormRow label={editForm.mediaType === 'video' ? 'Video' : editForm.mediaType === 'gif' ? 'GIF' : 'Image'}>
              {editForm.mediaType === 'video' ? (
                <ImageUploadField
                  accept="image+video"
                  mediaType="video"
                  value={editForm.videoSrc}
                  onChange={(videoSrc) => setEditForm((f) => ({ ...f, videoSrc }))}
                />
              ) : (
                <ImageUploadField
                  accept="image+video"
                  mediaType={editForm.mediaType === 'gif' ? 'gif' : 'image'}
                  value={editForm.src}
                  onChange={(src) => setEditForm((f) => ({ ...f, src }))}
                />
              )}
            </FormRow>
            {editForm.mediaType === 'video' && (
              <FormRow label="Poster image (optional)">
                <ImageUploadField value={editForm.src} onChange={(src) => setEditForm((f) => ({ ...f, src }))} />
              </FormRow>
            )}
            <FormRow label="Alt text">
              <input
                className="form-input"
                value={editForm.alt}
                onChange={(e) => setEditForm((f) => ({ ...f, alt: e.target.value }))}
              />
            </FormRow>
            <FormRow label="Caption (optional)">
              <input
                className="form-input"
                value={editForm.caption}
                onChange={(e) => setEditForm((f) => ({ ...f, caption: e.target.value }))}
              />
            </FormRow>
            <FormRow label="Category (optional)">
              <input
                className="form-input"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
              />
            </FormRow>
            {editError && (
              <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                {editError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={editImage.isPending}>
                {editImage.isPending ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingImage(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
