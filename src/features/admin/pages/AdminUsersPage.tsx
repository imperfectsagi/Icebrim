import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { AdminPageHeader, AdminCard, FormRow } from '../components/AdminUi';
import { Button } from '@/components/ui/Button';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '@/lib/api-client';

const accountSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Enter a valid email address'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number')
      .regex(/[^A-Za-z0-9]/, 'Include at least one symbol'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type AccountFormValues = z.infer<typeof accountSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export function AdminUsersPage() {
  const { user } = useAuth();
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    values: user ? { username: user.username, email: user.email } : undefined,
  });

  const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

  const onAccountSubmit = async (values: AccountFormValues) => {
    setAccountMessage(null);
    try {
      // Server re-validates uniqueness and hashes are never touched here;
      // this only updates username/email fields.
      await api.put('/api/admin/users/me', values);
      setAccountMessage('Account details updated.');
    } catch (err) {
      setAccountMessage(err instanceof ApiError ? err.message : 'Update failed. Try again.');
    }
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setPasswordMessage(null);
    try {
      // The Worker hashes the new password with Argon2/bcrypt server-side --
      // plaintext only ever travels over HTTPS to this one endpoint and is
      // never stored or logged.
      await api.put('/api/admin/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setPasswordMessage('Password changed successfully.');
      passwordForm.reset();
    } catch (err) {
      setPasswordMessage(err instanceof ApiError ? err.message : 'Password change failed. Try again.');
    }
  };

  return (
    <div>
      <AdminPageHeader title="Users" description="Manage your admin account." />

      <div className="space-y-6 max-w-lg">
        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Account details</h2>
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} noValidate className="space-y-4">
            <FormRow label="Username" error={accountForm.formState.errors.username?.message}>
              <input className="form-input" {...accountForm.register('username')} />
            </FormRow>
            <FormRow label="Email" error={accountForm.formState.errors.email?.message}>
              <input type="email" className="form-input" {...accountForm.register('email')} />
            </FormRow>
            {accountMessage && <p className="text-sm text-[var(--color-coral-deep)]">{accountMessage}</p>}
            <Button type="submit" size="sm" disabled={accountForm.formState.isSubmitting}>
              Save
            </Button>
          </form>
        </AdminCard>

        <AdminCard className="space-y-4">
          <h2 className="font-semibold">Change password</h2>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} noValidate className="space-y-4">
            <FormRow label="Current password" error={passwordForm.formState.errors.currentPassword?.message}>
              <input type="password" autoComplete="current-password" className="form-input" {...passwordForm.register('currentPassword')} />
            </FormRow>
            <FormRow
              label="New password"
              hint="At least 12 characters, with an uppercase letter, a number, and a symbol."
              error={passwordForm.formState.errors.newPassword?.message}
            >
              <input type="password" autoComplete="new-password" className="form-input" {...passwordForm.register('newPassword')} />
            </FormRow>
            <FormRow label="Confirm new password" error={passwordForm.formState.errors.confirmPassword?.message}>
              <input type="password" autoComplete="new-password" className="form-input" {...passwordForm.register('confirmPassword')} />
            </FormRow>
            {passwordMessage && <p className="text-sm text-[var(--color-coral-deep)]">{passwordMessage}</p>}
            <Button type="submit" size="sm" disabled={passwordForm.formState.isSubmitting}>
              Change password
            </Button>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
