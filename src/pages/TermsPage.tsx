import { LegalPageLayout } from '@/components/common/LegalPageLayout';

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms &amp; Conditions" updatedDate="1 August 2026" canonicalPath="/terms">
      <p>
        These Terms and Conditions govern your use of icebrim.com and any purchase made through
        the site. By using this site or placing an order, you agree to these terms.
      </p>
      <h2>Products</h2>
      <p>
        Icebrim products are comfort and self-care accessories and are not intended to diagnose,
        treat, cure, or prevent any medical condition. If you have a medical concern, please
        consult a qualified healthcare professional.
      </p>
      <h2>Orders and payment</h2>
      <p>
        All orders are subject to acceptance and availability. Prices are shown in GBP and include
        VAT where applicable. We reserve the right to correct pricing errors before dispatch.
      </p>
      <h2>Delivery and returns</h2>
      <p>
        We offer free UK delivery on orders over £30 and accept returns within 30 days of delivery
        for unused items in their original packaging.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, Icebrim Ltd's liability for any claim relating to your use
        of the site or products is limited to the amount paid for the relevant order.
      </p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of England and Wales.</p>
    </LegalPageLayout>
  );
}
