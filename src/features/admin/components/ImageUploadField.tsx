import { useRef, useState } from 'react';
import { Upload, X, Loader2, Film } from 'lucide-react';
import { hasLiveApi, API_BASE_URL } from '@/lib/api-client';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const GIF_TYPE = 'image/gif';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB pre-compression ceiling; server re-compresses/resizes
const MAX_VIDEO_SIZE_BYTES = 15 * 1024 * 1024; // 15MB -- no server-side video compression exists, so this is the real ceiling; compress before upload if your file is larger
const MAX_GIF_SIZE_BYTES = 8 * 1024 * 1024; // 8MB -- GIFs are stored as-is, not re-encoded

export type MediaKind = 'image' | 'video' | 'gif';

/** Fixed set of storage categories -- must match workers/src/routes/media.ts. */
export type MediaCategory = 'products' | 'hero-media' | 'blog' | 'company' | 'gallery' | 'reviews' | 'other';

function guessKindFromValue(value: string): MediaKind {
  if (/\.(mp4|webm|mov)(\?|$)/i.test(value)) return 'video';
  if (/\.gif(\?|$)/i.test(value)) return 'gif';
  return 'image';
}

/**
 * Uploads a file to `POST /api/admin/media/upload`, which the Worker
 * validates (magic-byte sniffing, not just extension/declared type),
 * compresses images, and stores everything in R2 -- returning the public
 * R2 URL. See /workers/src/routes/media.ts.
 *
 * Client-side checks here are for fast user feedback only; the server
 * revalidates everything, since client-side validation can be bypassed.
 *
 * `accept="image"` (default) keeps the original image-only behavior used
 * by products and the logo. `accept="image+video"` additionally allows
 * MP4/WEBM video and GIF -- used for the banner, gallery, blog featured
 * media, and review attachments.
 */
export function ImageUploadField({
  value,
  onChange,
  accept = 'image',
  mediaType,
  onMediaTypeChange,
  category = 'other',
}: {
  value: string;
  onChange: (url: string) => void;
  accept?: 'image' | 'image+video';
  /** Current media kind, if the caller tracks it separately from the URL. */
  mediaType?: MediaKind;
  /** Called with the detected kind of whatever was just uploaded. */
  onMediaTypeChange?: (kind: MediaKind) => void;
  /** Storage category -- determines the R2 folder new uploads land in
   * (see FIX-025). Defaults to 'other' if not specified by the caller. */
  category?: MediaCategory;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowsVideo = accept === 'image+video';
  const acceptedMimeTypes = allowsVideo ? [...IMAGE_TYPES, ...VIDEO_TYPES, GIF_TYPE] : IMAGE_TYPES;
  const resolvedKind = mediaType ?? guessKindFromValue(value);

  const handleFile = async (file: File) => {
    setError(null);

    const isImage = IMAGE_TYPES.includes(file.type);
    const isGif = file.type === GIF_TYPE;
    const isVideo = VIDEO_TYPES.includes(file.type);

    if (!isImage && !isGif && !isVideo) {
      setError(
        allowsVideo
          ? 'Only PNG, JPG, WEBP, GIF, MP4, or WEBM files are supported.'
          : 'Only PNG, JPG, and WEBP images are supported.',
      );
      return;
    }
    if ((isVideo || isGif) && !allowsVideo) {
      setError('Video and GIF are not supported here -- only images.');
      return;
    }
    if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Image must be smaller than 8MB.');
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
      setError('Video must be smaller than 15MB. Compress it first -- there is no automatic video compression.');
      return;
    }
    if (isGif && file.size > MAX_GIF_SIZE_BYTES) {
      setError('GIF must be smaller than 8MB.');
      return;
    }

    const kind: MediaKind = isVideo ? 'video' : isGif ? 'gif' : 'image';

    if (!hasLiveApi) {
      // Local dev without a deployed Worker: preview via object URL so the
      // admin UI remains usable. Not persisted -- wire VITE_API_BASE_URL
      // to actually store files in R2.
      onChange(URL.createObjectURL(file));
      onMediaTypeChange?.(kind);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
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
      onMediaTypeChange?.((data.mediaType as MediaKind | undefined) ?? kind);
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
            {resolvedKind === 'video' ? (
              <video src={value} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <img src={value} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}
            {resolvedKind === 'video' && (
              <span className="absolute bottom-1 left-1 bg-black/60 text-white rounded p-0.5" aria-hidden="true">
                <Film size={11} />
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Remove media"
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
            <span className="text-[10px]">{allowsVideo ? 'Upload' : 'Upload'}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptedMimeTypes.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {allowsVideo && !value && (
        <p className="text-[10px] text-[var(--color-ink-soft)] mt-1 max-w-24">
          Image, GIF, or video (MP4/WEBM, max 15MB)
        </p>
      )}
      {error && <p className="text-xs text-[var(--color-coral-deep)] mt-1 max-w-24">{error}</p>}
    </div>
  );
}
