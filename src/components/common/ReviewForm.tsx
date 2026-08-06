import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api-client';

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

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      // Reviews are stored as status="pending" and only appear publicly
      // after admin approval (see Admin Panel > Reviews).
      await api.post('/api/reviews', { productSlug, ...values });
      setSubmitted(true);
      reset();
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

      {submitError && (
        <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
          {submitError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
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
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
      {error && <p className="text-xs text-[var(--color-coral-deep)] mt-1">{error}</p>}
    </div>
  );
}
