import type { ReactNode } from 'react';
import { Snowflake } from 'lucide-react';
import { useMaintenanceStatus } from '@/hooks/useContent';

/**
 * Wraps the public site tree. While maintenance mode is enabled in
 * Admin > System Settings, visitors see a simple holding page instead
 * of the normal site. The admin panel (/admin/*) is mounted separately
 * in the router and is never wrapped by this gate, so admins can always
 * sign in and turn maintenance mode back off.
 *
 * Fails open: if the status check errors or hasn't loaded yet, the real
 * site renders as normal rather than blocking visitors on a network hiccup.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { data } = useMaintenanceStatus();

  if (data?.maintenanceMode) {
    return <MaintenancePage message={data.maintenanceMessage} />;
  }

  return <>{children}</>;
}

function MaintenancePage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-[var(--color-ice)] flex items-center justify-center">
          <Snowflake size={26} className="text-[var(--color-ice-deep)]" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-medium mb-3">
          We'll be right back
        </h1>
        <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
          {message || "We're making some improvements. Please check back shortly."}
        </p>
      </div>
    </div>
  );
}
