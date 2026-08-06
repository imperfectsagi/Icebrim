import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

const schema = z.object({
  email: z.string().min(1, 'Enter your email address').email('Enter a valid email address'),
});

type FormValues = z.infer<typeof schema>;

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    // Wired to POST /api/newsletter once the Workers API is deployed.
    await new Promise((r) => setTimeout(r, 400));
    void values;
    setSubmitted(true);
    reset();
  };

  if (submitted) {
    return (
      <p className="text-sm font-medium text-[var(--color-coral-deep)]" role="status">
        You're on the list — check your inbox for 10% off.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full md:w-auto">
      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <div className="w-full sm:w-64">
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Email address"
            autoComplete="email"
            className="w-full rounded-full border border-[var(--color-line)] bg-white px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-coral-deep)]"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'newsletter-email-error' : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id="newsletter-email-error" className="text-xs text-[var(--color-coral-deep)] mt-1">
              {errors.email.message}
            </p>
          )}
        </div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </div>
    </form>
  );
}
