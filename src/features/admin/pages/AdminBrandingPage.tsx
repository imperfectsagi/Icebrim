import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';
import { deriveShades, DEFAULT_ACCENT_COLOR } from '@/lib/color';

interface ThemeSettings {
  accentColor: string;
}

const seed: ThemeSettings = { accentColor: DEFAULT_ACCENT_COLOR };

let localTheme = { ...seed };

const hexPattern = /^#[0-9a-fA-F]{6}$/;

const schema = z.object({
  accentColor: z.string().regex(hexPattern, 'Enter a hex color like #11534E'),
});

// A handful of ready-made options so the admin isn't required to know
// hex codes -- tap a swatch, or fine-tune with the native color picker
// / type a hex code directly.
const PRESETS = [
  { label: 'Brand green (default)', value: '#11534E' },
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
  const previewColor = hexPattern.test(currentColor) ? currentColor : DEFAULT_ACCENT_COLOR;
  const previewShades = deriveShades(previewColor);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title="Branding"
        description="Choose the accent (coral) color used for primary buttons, active links, and highlights across the site and admin panel. The ice-blue cooling motif is a fixed brand color and isn't affected by this setting."
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
                  value={hexPattern.test(field.value) ? field.value : '#11534E'}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-label="Pick accent color"
                  className="h-14 w-14 rounded-lg border border-[var(--color-line)] cursor-pointer p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                />
              )}
            />
            <FormRow label="Hex code" error={errors.accentColor?.message} hint="e.g. #11534E">
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
            <p className="text-xs text-[var(--color-ink-soft)] mb-3">
              Everything below updates live as you pick a color -- this is the full set of places
              the accent color affects.
            </p>
            <div
              className="rounded-lg p-4 flex flex-col gap-4"
              style={{ backgroundColor: '#fbf7f5' }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: previewColor }}
                >
                  Primary button
                </span>
                <span
                  className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: previewShades.deep }}
                >
                  Primary button (hover)
                </span>
                <span className="text-sm font-medium underline" style={{ color: previewColor }}>
                  A link in this color
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                  style={{ backgroundColor: previewShades.tint, color: previewShades.deep }}
                >
                  Active nav / selected state
                </span>
                <span
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full"
                  style={{ backgroundColor: previewShades.tint }}
                  aria-hidden="true"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: previewColor }}
                  />
                </span>
                <span className="text-xs text-[var(--color-ink-soft)]">Tinted surface</span>
              </div>
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
