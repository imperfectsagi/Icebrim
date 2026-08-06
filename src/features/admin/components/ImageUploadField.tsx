import { useRef, useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { hasLiveApi, API_BASE_URL } from '@/lib/api-client';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB pre-compression ceiling; server re-compresses/resizes

/**
 * Uploads an image to `POST /api/admin/media/upload`, which the Worker
 * validates (MIME type sniffing, not just extension/declared type,
 * plus a magic-byte check), compresses, resizes, and stores in R2 --
 * returning the public R2 URL. See /workers/src/routes/media.ts.
 *
 * Client-side checks here are for fast user feedback only; the server
 * revalidates everything, since client-side validation can be bypassed.
 */
export function ImageUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only PNG, JPG, and WEBP images are supported.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image must be smaller than 8MB.');
      return;
    }

    if (!hasLiveApi) {
      // Local dev without a deployed Worker: preview via object URL so the
      // admin UI remains usable. Not persisted -- wire VITE_API_BASE_URL
      // to actually store images in R2.
      onChange(URL.createObjectURL(file));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE_URL}/api/admin/media/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? 'Upload failed');
      }
      const data = await response.json();
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="h-24 w-24 rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-center overflow-hidden relative">
        {value ? (
          <>
            <img src={value} alt="" loading="lazy" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Remove image"
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-1 text-[var(--color-ink-soft)]"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            <span className="text-[10px]">Upload</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <p className="text-xs text-[var(--color-coral-deep)] mt-1 max-w-24">{error}</p>}
    </div>
  );
}
