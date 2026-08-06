import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';

interface ThemeSettings {
  accentColor: string;
}

const seed: ThemeSettings = { accentColor: '#ff6b5b' };

let localTheme = { ...seed };

const hexPattern = /^#[0-9a-fA-F]{6}$/;

const schema = z.object({
  accentColor: z.string().regex(hexPattern, 'Enter a hex color like #ff6b5b'),
});

// A handful of ready-made options so the admin isn't required to know
// hex codes -- tap a swatch, or fine-tune with the native color picker
// / type a hex code directly.
const PRESETS = [
  { label: 'Coral (default)', value: '#ff6b5b' },
  { label: 'Ice blue', value: '#4fa7ae' },
  { label: 'Berry', value: '#c0447a' },
  { label: 'Forest', value: '#3f7a5c' },
  { label: 'Amber', value: '#e08a2b' },
  { label: 'Slate', value: '#4a5568' },
];

export function AdminBrandingPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<ThemeSettings>({
    queryKey: ['admin', 'theme-settings'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/settings/theme') : Promise.resolve(localTheme)),
  });

  const updateSettings = useMutation({
    mutationFn: (input: ThemeSettings) =>
      hasLiveApi ? api.put('/api/admin/settings/theme', input) : Promise.resolve((localTheme = input)),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'theme-settings'] });
      // Also refresh the public-facing theme query so the color change
      // is visible immediately without a full page reload.
      qc.setQueryData(['settings', 'theme'], data);
    },
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ThemeSettings>({ resolver: zodResolver(schema), defaultValues: seed });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  const currentColor = watch('accentColor');

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title="Branding"
        description="Choose the accent color used for buttons, links, and highlights across the site and admin panel."
      />

      <form onSubmit={handleSubmit((v) => updateSettings.mutate(v))} noValidate className="space-y-6 max-w-xl">
        <AdminCard className="space-y-5">
          <div className="flex items-center gap-4">
            <Controller
              control={control}
              name="accentColor"
              render={({ field }) => (
                <input
                  type="color"
                  value={hexPattern.test(field.value) ? field.value : '#ff6b5b'}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-label="Pick accent color"
                  className="h-14 w-14 rounded-lg border border-[var(--color-line)] cursor-pointer p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                />
              )}
            />
            <FormRow label="Hex code" error={errors.accentColor?.message} hint="e.g. #ff6b5b">
              <input
                type="text"
                className="form-input font-mono"
                maxLength={7}
                {...register('accentColor')}
              />
            </FormRow>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Quick picks</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Controller
                  key={preset.value}
                  control={control}
                  name="accentColor"
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(preset.value)}
                      aria-label={preset.label}
                      aria-pressed={field.value?.toLowerCase() === preset.value}
                      className="h-9 w-9 rounded-full border-2 transition-transform hover:scale-105"
                      style={{
                        backgroundColor: preset.value,
                        borderColor:
                          field.value?.toLowerCase() === preset.value ? 'var(--color-ink)' : 'transparent',
                      }}
                    />
                  )}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Preview</p>
            <div
              className="rounded-lg p-4 flex items-center gap-3 flex-wrap"
              style={{ backgroundColor: '#fbf7f5' }}
            >
              <span
                className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: hexPattern.test(currentColor) ? currentColor : '#ff6b5b' }}
              >
                Primary button
              </span>
              <span
                className="text-sm font-medium underline"
                style={{ color: hexPattern.test(currentColor) ? currentColor : '#ff6b5b' }}
              >
                A link in this color
              </span>
            </div>
          </div>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
