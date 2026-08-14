import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2 } from 'lucide-react';
import { AdminPageHeader } from '../components/AdminUi';
import { api, hasLiveApi, API_BASE_URL } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
  mediaType: 'image' | 'video' | 'gif';
  category: 'products' | 'hero-media' | 'blog' | 'company' | 'gallery' | 'other';
}

const CATEGORY_TABS: { value: MediaItem['category'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'products', label: 'Products' },
  { value: 'hero-media', label: 'Hero/Banner' },
  { value: 'blog', label: 'Blog' },
  { value: 'company', label: 'Company' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'other', label: 'Other' },
];

function useMediaLibrary(category: string) {
  return useQuery<MediaItem[]>({
    queryKey: ['admin', 'media', category],
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/admin/media${category !== 'all' ? `?category=${category}` : ''}`)
        : Promise.resolve([]),
  });
}

function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/media/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'media'] }),
  });
}

export function AdminMediaPage() {
  const [category, setCategory] = useState<MediaItem['category'] | 'all'>('all');
  const { data: media, isLoading } = useMediaLibrary(category);
  const deleteMedia = useDeleteMedia();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    if (!hasLiveApi) {
      window.alert(
        'Connect a live backend (VITE_API_BASE_URL) to store files in the Media Library.',
      );
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'other');

      const response = await fetch(`${API_BASE_URL}/api/admin/media/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Upload failed (${response.status})`);
      }

      qc.invalidateQueries({ queryKey: ['admin', 'media'] });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Media Library"
        description="All images and video uploaded across products, blog posts, banners, gallery, and company settings."
        action={{
          label: uploading ? 'Uploading…' : 'Upload Image',
          onClick: () => inputRef.current?.click(),
        }}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-1.5 mb-5" role="tablist" aria-label="Filter by folder">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={category === tab.value}
            onClick={() => setCategory(tab.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
              category === tab.value
                ? 'bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)]'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-alt)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {uploadError && (
        <p role="alert" className="text-sm text-[var(--color-coral-deep)] mb-4">
          {uploadError}
        </p>
      )}

      {isLoading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>
      ) : (media ?? []).length === 0 ? (
        <div className="bg-white rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] p-12 text-center">
          <Upload size={24} className="mx-auto mb-3 text-[var(--color-ink-soft)]" />
          <p className="text-sm text-[var(--color-ink-soft)]">
            {category === 'all'
              ? 'No media uploaded yet. Images uploaded via product, blog, or banner forms will also appear here.'
              : `No media in "${CATEGORY_TABS.find((t) => t.value === category)?.label}" yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {(media ?? []).map((item) => (
            <div key={item.id} className="group relative rounded-lg overflow-hidden border border-[var(--color-line)] aspect-square bg-[var(--color-surface-alt)]">
              {item.mediaType === 'video' ? (
                <video
                  src={item.url}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => e.currentTarget.pause()}
                />
              ) : (
                <img src={item.url} alt={item.filename} loading="lazy" className="h-full w-full object-cover" />
              )}
              <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium uppercase tracking-wide">
                {item.category}
              </span>
              <button
                onClick={() => deleteMedia.mutate(item.id)}
                aria-label={`Delete ${item.filename}`}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
