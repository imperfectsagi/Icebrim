import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';
import { useAuth } from '../auth/AuthContext';

interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  /** Expected length of maintenance in days. 0 = no estimate. */
  maintenanceDurationDays: number;
  /** End maintenance by itself when the days are up (otherwise it stays on until switched off). */
  maintenanceAutoEnd: boolean;
  sessionTimeoutMinutes: number;
  // Server-managed, read-only:
  maintenanceStartedAt?: string | null;
  maintenanceEndsAt?: string | null;
  maintenanceActive?: boolean;
}

const seed: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage: '',
  maintenanceDurationDays: 0,
  maintenanceAutoEnd: false,
  sessionTimeoutMinutes: 15,
};

let localSettings: SystemSettings = { ...seed };

const schema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().max(500, 'Keep the message under 500 characters'),
  maintenanceDurationDays: z
    .number({ error: 'Enter a number of days (0 for no end date)' })
    .int('Use a whole number of days')
    .min(0, 'Days cannot be negative')
    .max(365, 'Maximum is 365 days'),
  maintenanceAutoEnd: z.boolean(),
  sessionTimeoutMinutes: z
    .number({ error: 'Enter the timeout in minutes' })
    .int('Use a whole number of minutes')
    .min(5, 'Minimum is 5 minutes')
    .max(1440, 'Maximum is 1440 minutes (24 hours)'),
});

type FormValues = z.infer<typeof schema>;

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'Europe/London',
});

function formatWhen(iso: string | null | undefined) {
  return iso ? dateFormat.format(new Date(iso)) : '';
}

export function AdminSystemSettingsPage() {
  const qc = useQueryClient();
  const { refreshSession } = useAuth();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { data: settings, isLoading, isError } = useQuery<SystemSettings>({
    queryKey: ['admin', 'system-settings'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/settings/system') : Promise.resolve(localSettings)),
  });

  const updateSettings = useMutation({
    mutationFn: (input: FormValues) =>
      hasLiveApi
        ? api.put<SystemSettings>('/api/admin/settings/system', input)
        : Promise.resolve((localSettings = { ...localSettings, ...input })),
    onSuccess: async (saved) => {
      qc.setQueryData(['admin', 'system-settings'], saved);
      // The public site reads maintenance status on its own query -- refresh
      // it so this browser sees the change immediately too.
      qc.invalidateQueries({ queryKey: ['settings', 'maintenance'] });
      // Pick up the new session timeout for this admin's own idle timer.
      await refreshSession();
      setSavedAt(Date.now());
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: seed });

  useEffect(() => {
    if (settings) {
      reset({
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage ?? '',
        maintenanceDurationDays: settings.maintenanceDurationDays ?? 0,
        maintenanceAutoEnd: settings.maintenanceAutoEnd ?? false,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
      });
    }
  }, [settings, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;
  if (isError) return <p role="alert" className="text-sm text-[var(--color-coral-deep)]">Could not load system settings. Refresh the page to try again.</p>;

  const maintenanceOn = watch('maintenanceMode');
  const days = watch('maintenanceDurationDays');

  return (
    <div>
      <AdminPageHeader title="System Settings" description="Maintenance mode and session configuration." />

      <form
        onSubmit={handleSubmit((v) => {
          setSavedAt(null);
          updateSettings.mutate(v);
        })}
        noValidate
        className="space-y-6 max-w-lg"
      >
        {settings?.maintenanceActive && (
          <div role="status" className="rounded-xl border border-[var(--color-coral-deep)] bg-[var(--color-coral-tint)] px-4 py-3 text-sm text-[var(--color-ink)]">
            <p className="font-semibold">Maintenance mode is ON — visitors see the maintenance page.</p>
            {settings.maintenanceStartedAt && <p className="mt-1">Started: {formatWhen(settings.maintenanceStartedAt)}</p>}
            {settings.maintenanceEndsAt ? (
              <p>
                {settings.maintenanceAutoEnd ? 'Ends automatically:' : 'Expected to end:'} {formatWhen(settings.maintenanceEndsAt)}
                {!settings.maintenanceAutoEnd && ' (it stays on until you switch it off)'}
              </p>
            ) : (
              <p>No end date set — it stays on until you switch it off.</p>
            )}
          </div>
        )}

        <AdminCard className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...register('maintenanceMode')} />
            Enable maintenance mode
          </label>

          <FormRow label="Maintenance message" hint="Shown to visitors while maintenance mode is on" error={errors.maintenanceMessage?.message}>
            <textarea rows={2} className="form-input" placeholder="We're making some improvements. Please check back shortly." {...register('maintenanceMessage')} />
          </FormRow>

          <FormRow
            label="Maintenance duration (days)"
            hint="How many days maintenance is expected to last. For your reference only -- visitors see just your message, not a date. Counts from when maintenance is switched on. Use 0 for no estimate."
            error={errors.maintenanceDurationDays?.message}
          >
            <input
              type="number"
              min={0}
              max={365}
              step={1}
              inputMode="numeric"
              className="form-input"
              {...register('maintenanceDurationDays', { setValueAs: (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)) })}
            />
          </FormRow>

          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" className="h-4 w-4 mt-0.5" disabled={!days || days <= 0} {...register('maintenanceAutoEnd')} />
            <span>
              <span className="font-medium">Switch maintenance off automatically when the days are up</span>
              <span className="block text-xs text-[var(--color-ink-soft)]">
                Leave this unticked and maintenance stays on until you turn it off here, however long that takes.
              </span>
            </span>
          </label>

          {maintenanceOn && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              Customers will not be able to browse or check out while this is on. This admin panel keeps working.
            </p>
          )}
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow
            label="Admin session timeout (minutes)"
            hint="Admins are signed out automatically after this many minutes of inactivity (5–1440)."
            error={errors.sessionTimeoutMinutes?.message}
          >
            <input
              type="number"
              min={5}
              max={1440}
              step={1}
              inputMode="numeric"
              className="form-input"
              {...register('sessionTimeoutMinutes', { valueAsNumber: true })}
            />
          </FormRow>
        </AdminCard>

        {updateSettings.isError && (
          <p role="alert" className="text-sm text-[var(--color-coral-deep)]">
            {updateSettings.error instanceof Error ? updateSettings.error.message : 'Could not save settings. Please try again.'}
          </p>
        )}
        {savedAt && !updateSettings.isError && (
          <p role="status" className="text-sm font-medium text-[var(--color-coral)]">
            Settings saved.
          </p>
        )}

        <Button type="submit" disabled={isSubmitting || updateSettings.isPending}>
          {isSubmitting || updateSettings.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
