import { LegalPageLayout } from '@/components/common/LegalPageLayout';

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout title="Cookie Policy" updatedDate="1 August 2026" canonicalPath="/cookie-policy">
      <p>
        This Cookie Policy explains how Icebrim Ltd uses cookies and similar technologies on
        icebrim.com.
      </p>
      <h2>What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device that help websites function and
        remember your preferences.
      </p>
      <h2>Types of cookies we use</h2>
      <ul>
        <li>
          <strong>Essential cookies</strong> — required for the site to function, such as
          remembering items in your cart.
        </li>
        <li>
          <strong>Analytics cookies</strong> — help us understand how visitors use the site so we
          can improve it.
        </li>
        <li>
          <strong>Marketing cookies</strong> — used to show relevant offers, only set if you accept
          them.
        </li>
      </ul>
      <h2>Managing your preferences</h2>
      <p>
        When you first visit our site, you can choose to accept or reject non-essential cookies via
        the cookie banner. You can change your browser settings at any time to block or delete
        cookies.
      </p>
    </LegalPageLayout>
  );
}
