import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useId, useState, cloneElement, useRef } from 'react';
import { Star, Upload, X, Loader2, Film } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { api, ApiError, API_BASE_URL, hasLiveApi } from '@/lib/api-client';

const MAX_REVIEW_IMAGES = 6;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const schema = z.object({
  authorName: z.string().min(2, 'Enter your name').max(80),
  location: z.string().max(80).optional(),
  rating: z.number().min(1, 'Choose a rating').max(5),
  title: z.string().min(3, 'Give your review a short title').max(120),
  body: z.string().min(10, 'Write at least a few words').max(2000),
  // Honeypot field: real visitors never fill this in. Bots that
  // autofill every field will trip it, giving cheap spam protection
  // without a CAPTCHA on every legitimate submission. We accept any
  // value here (rather than rejecting non-empty at the schema level)
  // so a filled honeypot doesn't surface a visible validation error --
  // the server silently accepts-and-drops the submission instead.
  companyWebsite: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

/**
 * Uploads a customer-submitted review attachment to the public,
 * unauthenticated `POST /api/media/review-upload` endpoint (see
 * workers/src/routes/media.ts publicMedia router) -- NOT the admin
 * `/api/admin/media/upload` endpoint ImageUploadField.tsx uses, since
 * anonymous customers submitting a review are never logged in as admin.
 */
async function uploadReviewMedia(file: File): Promise<string> {
  if (!hasLiveApi) {
    // Local dev without a deployed Worker: preview via object URL so the
    // form remains usable. Not persisted.
    return URL.createObjectURL(file);
  }
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/media/review-upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'Upload failed');
  }
  const data = await response.json();
  return data.url as string;
}

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mediaImages, setMediaImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rating: 0 },
  });

  const handleImagesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMediaError(null);
    const remaining = MAX_REVIEW_IMAGES - mediaImages.length;
    if (remaining <= 0) {
      setMediaError(`You can attach up to ${MAX_REVIEW_IMAGES} photos.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      if (!IMAGE_TYPES.includes(file.type)) {
        setMediaError('Photos must be PNG, JPG, or WEBP.');
        continue;
      }
      setImageUploading(true);
      try {
        const url = await uploadReviewMedia(file);
        setMediaImages((prev) => [...prev, url]);
      } catch (err) {
        setMediaError(err instanceof Error ? err.message : 'Photo upload failed. Please try again.');
      } finally {
        setImageUploading(false);
      }
    }
  };

  const handleVideoSelected = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setMediaError(null);
    if (!VIDEO_TYPES.includes(file.type)) {
      setMediaError('Video must be MP4, WEBM, or MOV.');
      return;
    }
    setVideoUploading(true);
    try {
      const url = await uploadReviewMedia(file);
      setVideoUrl(url);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Video upload failed. Please try again.');
    } finally {
      setVideoUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      // Reviews are stored as status="pending" and only appear publicly
      // after admin approval (see Admin Panel > Reviews).
      await api.post('/api/reviews', {
        productSlug,
        ...values,
        mediaType: videoUrl ? 'video' : 'none',
        mediaSrc: videoUrl || undefined,
        mediaImages,
      });
      setSubmitted(true);
      reset();
      setMediaImages([]);
      setVideoUrl('');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  };

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 text-center" role="status">
        <p className="font-semibold mb-1">Thanks for your review!</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          It will appear on this page once our team has approved it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 max-w-lg">
      {/* Honeypot: hidden from sighted users and screen readers, visible to bots */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] w-px h-px opacity-0"
        {...register('companyWebsite')}
      />

      <div>
        <label className="block text-sm font-medium mb-2">Your rating</label>
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <div className="flex gap-1" role="radiogroup" aria-label="Rating out of 5 stars">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={field.value === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => field.onChange(n)}
                  className="p-1"
                >
                  <Star
                    size={26}
                    className={cn(
                      field.value >= n
                        ? 'fill-[var(--color-coral)] text-[var(--color-coral)]'
                        : 'text-[var(--color-line)]',
                    )}
                  />
                </button>
              ))}
            </div>
          )}
        />
        {errors.rating && <p className="text-xs text-[var(--color-coral-deep)] mt-1">{errors.rating.message}</p>}
      </div>

      <Field label="Review title" error={errors.title?.message}>
        <input type="text" className="form-input" {...register('title')} />
      </Field>

      <Field label="Your review" error={errors.body?.message}>
        <textarea rows={4} className="form-input" {...register('body')} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Name" error={errors.authorName?.message}>
          <input type="text" className="form-input" {...register('authorName')} />
        </Field>
        <Field label="Location (optional)" error={errors.location?.message}>
          <input type="text" className="form-input" {...register('location')} />
        </Field>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Add photos (optional)</label>
        <div className="flex flex-wrap gap-2">
          {mediaImages.map((src, i) => (
            <div key={src} className="relative h-16 w-16 rounded-lg overflow-hidden border border-[var(--color-line)]">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setMediaImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                aria-label="Remove photo"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {mediaImages.length < MAX_REVIEW_IMAGES && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={imageUploading}
              className="h-16 w-16 rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-center"
              aria-label="Add photo"
            >
              {imageUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            </button>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => {
            void handleImagesSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-[var(--color-ink-soft)] mt-1">Up to {MAX_REVIEW_IMAGES} photos, PNG/JPG/WEBP.</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Add a short video (optional, ~10 seconds)</label>
        {videoUrl ? (
          <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-[var(--color-line)]">
            <video src={videoUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            <span className="absolute bottom-1 left-1 bg-black/60 text-white rounded p-0.5" aria-hidden="true">
              <Film size={11} />
            </span>
            <button
              type="button"
              onClick={() => setVideoUrl('')}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
              aria-label="Remove video"
            >
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={videoUploading}
            className="h-24 w-24 rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] flex items-center justify-center"
            aria-label="Add video"
          >
            {videoUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          </button>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            void handleVideoSelected(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="text-xs text-[var(--color-ink-soft)] mt-1">MP4, WEBM, or MOV, up to 15MB.</p>
      </div>

      {mediaError && (
        <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
          {mediaError}
        </p>
      )}

      {submitError && (
        <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
          {submitError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting || imageUploading || videoUploading}>
        {isSubmitting ? 'Submitting…' : 'Submit review'}
      </Button>

      <style>{`.form-input {
        width: 100%;
        border-radius: 0.75rem;
        border: 1px solid var(--color-line);
        padding: 0.65rem 0.9rem;
        font-size: 0.95rem;
        background-color: #ffffff;
        color: var(--color-ink);
        color-scheme: light;
      }
      .form-input::placeholder {
        color: var(--color-ink-soft);
        opacity: 1;
      }
      .form-input:focus-visible {
        outline: 2px solid var(--color-coral-deep);
        outline-offset: 2px;
      }`}</style>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-2">
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': !!error,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} className="text-xs text-[var(--color-coral-deep)] mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
