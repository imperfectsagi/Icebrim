import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'icebrim_cookie_consent';

type Consent = 'accepted' | 'rejected';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      // localStorage unavailable (private mode, etc.) — show banner each visit
      setVisible(true);
    }
  }, []);

  const setConsent = (value: Consent) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore persistence failure; banner will simply reappear next visit
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[70] p-4"
    >
      <div className="mx-auto max-w-3xl rounded-[var(--radius-card)] bg-white border border-[var(--color-line)] shadow-[var(--shadow-lift)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-[var(--color-ink-soft)] flex-1">
          We use cookies to improve your experience and understand site usage. See our{' '}
          <Link to="/cookie-policy" className="underline hover:text-[var(--color-coral-deep)]">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => setConsent('rejected')}>
            Reject All
          </Button>
          <Button size="sm" onClick={() => setConsent('accepted')}>
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
