import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { api, hasLiveApi } from '@/lib/api-client';

interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  sessionTimeoutMinutes: number;
}

const seed: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage: "We'll be back shortly.",
  sessionTimeoutMinutes: 15,
};

let localSettings = { ...seed };

const schema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().min(1),
  sessionTimeoutMinutes: z.number().min(5).max(120),
});

export function AdminSystemSettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<SystemSettings>({
    queryKey: ['admin', 'system-settings'],
    queryFn: () => (hasLiveApi ? api.get('/api/admin/settings/system') : Promise.resolve(localSettings)),
  });

  const updateSettings = useMutation({
    mutationFn: (input: SystemSettings) =>
      hasLiveApi
        ? api.put('/api/admin/settings/system', input)
        : Promise.resolve((localSettings = input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'system-settings'] }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<SystemSettings>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader title="System Settings" description="Maintenance mode and session configuration." />

      <form onSubmit={handleSubmit((v) => updateSettings.mutate(v))} noValidate className="space-y-6 max-w-lg">
        <AdminCard className="space-y-4">
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input type="checkbox" className="h-4 w-4" {...register('maintenanceMode')} />
            Enable maintenance mode
          </label>
          <FormRow label="Maintenance message" hint="Shown to visitors while maintenance mode is on">
            <textarea rows={2} className="form-input" {...register('maintenanceMessage')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <FormRow label="Admin session timeout (minutes)" hint="Automatic logout after inactivity">
            <input type="number" className="form-input" {...register('sessionTimeoutMinutes', { valueAsNumber: true })} />
          </FormRow>
        </AdminCard>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
