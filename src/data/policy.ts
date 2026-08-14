import type { PolicyPageContent, PolicyPageKey } from '@/types/cms';

/**
 * Local-mode fallback + initial seed content for the three policy pages,
 * used when VITE_API_BASE_URL isn't set (see hasLiveApi in
 * src/lib/api-client.ts) and as the value `site_content` should be
 * seeded with in production before an admin first edits each page. This
 * is the exact copy that was previously hardcoded directly into
 * PrivacyPolicyPage.tsx / CookiePolicyPage.tsx / TermsPage.tsx -- moving
 * it here (as HTML matching the sanitizer's allowed tag set in
 * workers/src/lib/sanitize-html.ts) is what makes it admin-editable
 * without losing the existing content.
 */
export const policyPages: Record<PolicyPageKey, PolicyPageContent> = {
  policy_privacy: {
    title: 'Privacy Policy',
    updatedDateLabel: '1 August 2026',
    contentHtml: `
      <p>This Privacy Policy explains how Icebrim Ltd ("Icebrim", "we", "us") collects, uses, and protects your personal information when you visit icebrim.com or place an order with us.</p>
      <h2>Information we collect</h2>
      <p>We collect information you provide directly, such as your name, email address, delivery address, and phone number when you place an order, contact us, or subscribe to our newsletter. We also collect limited technical information such as browser type and pages visited to help us improve the site.</p>
      <h2>How we use your information</h2>
      <ul>
        <li>To process and fulfil your orders</li>
        <li>To respond to enquiries you send us</li>
        <li>To send order updates and, where you've opted in, marketing emails</li>
        <li>To improve our website and product range</li>
      </ul>
      <h2>Sharing your information</h2>
      <p>We do not sell your personal data. We share information only with service providers who help us operate the business, such as payment processors and delivery couriers, and only to the extent needed to provide their service.</p>
      <h2>Your rights</h2>
      <p>Under UK data protection law you have the right to access, correct, or request deletion of your personal data. To make a request, contact us at hello@icebrim.com.</p>
      <h2>Contact us</h2>
      <p>If you have questions about this policy, please get in touch via our Contact page.</p>
    `.trim(),
  },
  policy_cookie: {
    title: 'Cookie Policy',
    updatedDateLabel: '1 August 2026',
    contentHtml: `
      <p>This Cookie Policy explains how Icebrim Ltd uses cookies and similar technologies on icebrim.com.</p>
      <h2>What are cookies?</h2>
      <p>Cookies are small text files stored on your device that help websites function and remember your preferences.</p>
      <h2>Types of cookies we use</h2>
      <ul>
        <li><strong>Essential cookies</strong> — required for the site to function, such as remembering items in your cart.</li>
        <li><strong>Analytics cookies</strong> — help us understand how visitors use the site so we can improve it.</li>
        <li><strong>Marketing cookies</strong> — used to show relevant offers, only set if you accept them.</li>
      </ul>
      <h2>Managing your preferences</h2>
      <p>When you first visit our site, you can choose to accept or reject non-essential cookies via the cookie banner. You can change your browser settings at any time to block or delete cookies.</p>
    `.trim(),
  },
  policy_terms: {
    title: 'Terms & Conditions',
    updatedDateLabel: '1 August 2026',
    contentHtml: `
      <p>These Terms and Conditions govern your use of icebrim.com and any purchase made through the site. By using this site or placing an order, you agree to these terms.</p>
      <h2>Products</h2>
      <p>Icebrim products are comfort and self-care accessories and are not intended to diagnose, treat, cure, or prevent any medical condition. If you have a medical concern, please consult a qualified healthcare professional.</p>
      <h2>Orders and payment</h2>
      <p>All orders are subject to acceptance and availability. Prices are shown in GBP and include VAT where applicable. We reserve the right to correct pricing errors before dispatch.</p>
      <h2>Delivery and returns</h2>
      <p>We offer free UK delivery on orders over £30 and accept returns within 30 days of delivery for unused items in their original packaging.</p>
      <h2>Limitation of liability</h2>
      <p>To the extent permitted by law, Icebrim Ltd's liability for any claim relating to your use of the site or products is limited to the amount paid for the relevant order.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
    `.trim(),
  },
};
