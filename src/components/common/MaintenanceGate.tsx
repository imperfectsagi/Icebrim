import type { ReactNode } from 'react';
import { Snowflake } from 'lucide-react';
import { useMaintenanceStatus } from '@/hooks/useContent';
import type { MaintenanceStatus } from '@/hooks/useContent';

/**
 * Wraps the public site tree. While maintenance mode is enabled in
 * Admin > System Settings, visitors see a simple holding page instead
 * of the normal site. The admin panel (/admin/*) is mounted separately
 * in the router and is never wrapped by this gate, so admins can always
 * sign in and turn maintenance mode back off.
 *
 * The status comes from /api/settings/maintenance, which is revalidated on
 * every request and re-checked every 30 seconds here, so switching the mode
 * on or off reaches visitors within moments. The API also refuses customer
 * orders/forms while it is on (workers/src/index.ts), so an already-open
 * page can't sneak a purchase through.
 *
 * Fails open: if the status check errors or hasn't loaded yet, the real
 * site renders as normal rather than blocking visitors on a network hiccup.
 */
export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { data } = useMaintenanceStatus();

  if (data?.maintenanceMode) {
    return <MaintenancePage status={data} />;
  }

  return <>{children}</>;
}

function MaintenancePage({ status }: { status: MaintenanceStatus }) {
  const back = status.maintenanceEndsAt ? new Date(status.maintenanceEndsAt) : null;
  const backLabel =
    back && back.getTime() > Date.now()
      ? back.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' })
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 h-14 w-14 rounded-full bg-[var(--color-ice)] flex items-center justify-center">
          <Snowflake size={26} className="text-[var(--color-ice-deep)]" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-medium mb-3">
          We'll be right back
        </h1>
        <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-line">
          {status.maintenanceMessage || "We're making some improvements. Please check back shortly."}
        </p>
        {backLabel && (
          <p className="mt-4 text-sm font-medium text-[var(--color-ink)]">Expected back: {backLabel}</p>
        )}
      </div>
    </div>
  );
}
