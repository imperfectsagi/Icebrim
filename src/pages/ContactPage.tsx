import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { Container, Eyebrow } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { SeoHead } from '@/components/common/SeoHead';
import { useCompanySettings } from '@/hooks/useContent';
import { api, ApiError } from '@/lib/api-client';

const schema = z.object({
  name: z.string().min(2, 'Enter your name').max(100),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: z.string().max(30).optional(),
  subject: z.string().min(3, 'Add a subject').max(150),
  message: z.string().min(10, 'Tell us a bit more').max(3000),
  // Honeypot spam trap, matched by the API's rate limiter + spam filter.
  // Any value is accepted here rather than rejected at validation time,
  // so a filled honeypot doesn't surface a visible error to the submitter
  // (bot or otherwise) -- the server silently accepts-and-drops it instead.
  companyWebsite: z.string().max(200).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ContactPage() {
  const { data: company } = useCompanySettings();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      // Messages are stored in D1 and appear in the Admin Panel's
      // Contact Messages module.
      await api.post('/api/contact', values);
      setSubmitted(true);
      reset();
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  };

  return (
    <>
      <SeoHead
        seo={{
          title: 'Contact Icebrim',
          description: 'Get in touch with the Icebrim team — questions, orders, and support.',
          canonicalPath: '/contact',
        }}
      />

      <section className="py-16 md:py-20">
        <Container className="grid md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <Eyebrow>Contact</Eyebrow>
            <h1 className="font-display text-3xl md:text-4xl font-medium mb-6 text-balance">
              We're happy to help
            </h1>
            <ul className="space-y-5 text-sm">
              <li className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 text-[var(--color-coral-deep)]" aria-hidden="true" />
                <a href={`mailto:${company?.email}`} className="hover:text-[var(--color-coral-deep)]">
                  {company?.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} className="mt-0.5 text-[var(--color-coral-deep)]" aria-hidden="true" />
                <a href={`tel:${company?.phone}`} className="hover:text-[var(--color-coral-deep)]">
                  {company?.phone}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5 text-[var(--color-coral-deep)]" aria-hidden="true" />
                <span>{company?.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <Clock size={18} className="mt-0.5 text-[var(--color-coral-deep)]" aria-hidden="true" />
                <div>
                  {company?.businessHours.map((bh) => (
                    <p key={bh.day}>
                      {bh.day}: {bh.hours}
                    </p>
                  ))}
                </div>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            {submitted ? (
              <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-8 text-center" role="status">
                <p className="font-semibold mb-1">Message sent</p>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Thanks for reaching out — we'll get back to you soon.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute -left-[9999px] w-px h-px opacity-0"
                  {...register('companyWebsite')}
                />

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Name" error={errors.name?.message}>
                    <input type="text" className="form-input" {...register('name')} />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <input type="email" className="form-input" {...register('email')} />
                  </Field>
                </div>

                <Field label="Phone (optional)" error={errors.phone?.message}>
                  <input type="tel" className="form-input" {...register('phone')} />
                </Field>

                <Field label="Subject" error={errors.subject?.message}>
                  <input type="text" className="form-input" {...register('subject')} />
                </Field>

                <Field label="Message" error={errors.message?.message}>
                  <textarea rows={5} className="form-input" {...register('message')} />
                </Field>

                {submitError && (
                  <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
                    {submitError}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send message'}
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
            )}
          </div>
        </Container>
      </section>
    </>
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
