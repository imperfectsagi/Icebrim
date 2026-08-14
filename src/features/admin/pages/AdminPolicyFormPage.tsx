import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { RichTextEditor } from '../components/RichTextEditor';
import { useAdminPolicyPage, useUpdatePolicyPage, useDeletePolicyPage } from '../hooks/useAdminPolicy';
import type { PolicyPageKey } from '@/types/cms';

const VALID_KEYS: PolicyPageKey[] = ['policy_privacy', 'policy_cookie', 'policy_terms'];
const LABELS: Record<PolicyPageKey, string> = {
  policy_privacy: 'Privacy Policy',
  policy_cookie: 'Cookie Policy',
  policy_terms: 'Terms & Conditions',
};

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  contentHtml: z.string(),
  updatedDateLabel: z.string().min(1, 'Add a date, e.g. "13 August 2026"'),
});

type FormValues = z.infer<typeof schema>;

export function AdminPolicyFormPage() {
  const { key } = useParams<{ key: string }>();

  if (!key || !VALID_KEYS.includes(key as PolicyPageKey)) {
    return <Navigate to="/admin/policies" replace />;
  }
  return <AdminPolicyForm policyKey={key as PolicyPageKey} />;
}

function AdminPolicyForm({ policyKey }: { policyKey: PolicyPageKey }) {
  const navigate = useNavigate();
  const { data: content, isLoading } = useAdminPolicyPage(policyKey);
  const updatePolicy = useUpdatePolicyPage(policyKey);
  const deletePolicy = useDeletePolicyPage(policyKey);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (content) {
      reset({
        title: content.title,
        contentHtml: content.contentHtml,
        updatedDateLabel: content.updatedDateLabel,
      });
    }
  }, [content, reset]);

  const onSubmit = async (values: FormValues) => {
    setSaveMessage(null);
    await updatePolicy.mutateAsync(values);
    setSaveMessage('Saved. The public page now shows this content.');
  };

  if (isLoading) return <p className="text-sm text-[var(--color-ink-soft)]">Loading…</p>;

  return (
    <div>
      <AdminPageHeader
        title={LABELS[policyKey]}
        description="Changes here go live on the public site immediately after saving -- no code deployment needed."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 max-w-3xl">
        <AdminCard className="space-y-4">
          <FormRow label="Page title" error={errors.title?.message}>
            <input className="form-input" {...register('title')} />
          </FormRow>
          <FormRow label="Last updated" hint='Shown on the page as "Last updated: ...". Set this manually when you make a substantive change.' error={errors.updatedDateLabel?.message}>
            <input className="form-input" {...register('updatedDateLabel')} />
          </FormRow>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Content</h2>
          <Controller
            control={control}
            name="contentHtml"
            render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
          />
        </AdminCard>

        {saveMessage && (
          <p role="status" className="text-sm text-[var(--color-coral-deep)]">
            {saveMessage}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button type="submit" disabled={isSubmitting || updatePolicy.isPending}>
            {isSubmitting || updatePolicy.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-[var(--color-coral-deep)]"
            onClick={() => setConfirmDelete(true)}
          >
            Clear page content
          </Button>
        </div>
      </form>

      {confirmDelete && (
        <ConfirmDeleteDialog
          label={LABELS[policyKey]}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deletePolicy.mutateAsync();
            setConfirmDelete(false);
            navigate('/admin/policies');
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  label,
  onCancel,
  onConfirm,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-white rounded-[var(--radius-card)] p-6 max-w-sm w-full">
        <h2 className="font-semibold mb-2">Clear {label}?</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mb-6">
          This removes the saved content for this page. The public page will show a "not yet
          published" message until new content is saved here. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-full text-sm font-medium border border-[var(--color-line)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-full text-sm font-medium bg-[var(--color-coral-deep)] text-white"
          >
            Clear content
          </button>
        </div>
      </div>
    </div>
  );
}
