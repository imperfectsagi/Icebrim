import { LegalPageLayout } from '@/components/common/LegalPageLayout';

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updatedDate="1 August 2026" canonicalPath="/privacy-policy">
      <p>
        This Privacy Policy explains how Icebrim Ltd ("Icebrim", "we", "us") collects, uses, and
        protects your personal information when you visit icebrim.com or place an order with us.
      </p>
      <h2>Information we collect</h2>
      <p>
        We collect information you provide directly, such as your name, email address, delivery
        address, and phone number when you place an order, contact us, or subscribe to our
        newsletter. We also collect limited technical information such as browser type and pages
        visited to help us improve the site.
      </p>
      <h2>How we use your information</h2>
      <ul>
        <li>To process and fulfil your orders</li>
        <li>To respond to enquiries you send us</li>
        <li>To send order updates and, where you've opted in, marketing emails</li>
        <li>To improve our website and product range</li>
      </ul>
      <h2>Sharing your information</h2>
      <p>
        We do not sell your personal data. We share information only with service providers who
        help us operate the business, such as payment processors and delivery couriers, and only
        to the extent needed to provide their service.
      </p>
      <h2>Your rights</h2>
      <p>
        Under UK data protection law you have the right to access, correct, or request deletion of
        your personal data. To make a request, contact us at hello@icebrim.com.
      </p>
      <h2>Contact us</h2>
      <p>If you have questions about this policy, please get in touch via our Contact page.</p>
    </LegalPageLayout>
  );
}
