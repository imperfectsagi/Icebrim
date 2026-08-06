import { Link } from 'react-router-dom';
import { InstagramIcon, FacebookIcon } from '@/components/ui/SocialIcons';
import { Container } from '@/components/ui/primitives';
import { useCompanySettings } from '@/hooks/useContent';
import { NewsletterForm } from '@/components/common/NewsletterForm';

const shopLinks = [
  { label: 'Cooling Relief Cap', href: '/products/cooling-relief-cap' },
  { label: 'Rotation Twin Pack', href: '/products/cooling-cap-twin-pack' },
  { label: 'All Products', href: '/products' },
];

const learnLinks = [
  { label: 'Blog', href: '/blog' },
  { label: 'Gallery', href: '/gallery' },
];

const companyLinks = [
  { label: 'About Icebrim', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

const policyLinks = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Cookie Policy', href: '/cookie-policy' },
  { label: 'Terms & Conditions', href: '/terms' },
];

export function Footer() {
  const { data: company } = useCompanySettings();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--color-surface)] border-t border-[var(--color-line)]">
      <Container className="py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              {company?.logo?.src ? (
                <img src={company.logo.src} alt={company.logo.alt} loading="lazy" className="h-7 w-auto" />
              ) : (
                <span className="font-display text-xl font-semibold">Icebrim</span>
              )}
            </Link>
            <p className="text-sm text-[var(--color-ink-soft)] max-w-xs">{company?.aboutShort}</p>
            <div className="flex items-center gap-3 mt-5">
              {company?.social.instagram && (
                <a
                  href={company.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Icebrim on Instagram"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-[var(--color-line)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral-deep)] transition-colors"
                >
                  <InstagramIcon width={16} height={16} />
                </a>
              )}
              {company?.social.facebook && (
                <a
                  href={company.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Icebrim on Facebook"
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-white border border-[var(--color-line)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral-deep)] transition-colors"
                >
                  <FacebookIcon width={16} height={16} />
                </a>
              )}
            </div>
          </div>

          <FooterColumn title="Shop" links={shopLinks} />
          <FooterColumn title="Learn" links={learnLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Policies" links={policyLinks} />
        </div>

        <div className="mt-14 pt-10 border-t border-[var(--color-line)] flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h3 className="font-display text-xl mb-1">Get 10% off your first order</h3>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Join our list for early access to new products and self-care guides.
            </p>
          </div>
          <NewsletterForm />
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--color-line)] text-xs text-[var(--color-ink-soft)] space-y-2">
          <p>{company?.copyright.replace('{year}', String(year))}</p>
          <p>{company?.footerNote}</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-4">{title}</h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              to={link.href}
              className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-coral-deep)] transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
