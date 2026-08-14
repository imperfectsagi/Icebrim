import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AdminPageHeader, AdminCard } from '../components/AdminUi';

const POLICY_PAGES: { key: string; label: string; description: string }[] = [
  { key: 'policy_privacy', label: 'Privacy Policy', description: 'How Icebrim collects, uses, and protects customer data.' },
  { key: 'policy_cookie', label: 'Cookie Policy', description: 'Which cookies the site uses and how visitors can manage them.' },
  { key: 'policy_terms', label: 'Terms & Conditions', description: 'The terms that govern orders, payment, shipping, and returns.' },
];

export function AdminPoliciesPage() {
  return (
    <div>
      <AdminPageHeader
        title="Policy Pages"
        description="Edit the content shown on the public Privacy Policy, Cookie Policy, and Terms & Conditions pages."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {POLICY_PAGES.map((page) => (
          <Link
            key={page.key}
            to={`/admin/policies/${page.key}`}
            className="block focus-visible:outline-2 focus-visible:outline-[var(--color-coral-deep)] rounded-[var(--radius-card)]"
          >
            <AdminCard className="h-full hover:border-[var(--color-coral)] transition-colors">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-full bg-[var(--color-coral-tint)] text-[var(--color-coral-deep)] flex items-center justify-center shrink-0">
                  <FileText size={16} />
                </span>
                <div>
                  <h2 className="font-semibold text-sm">{page.label}</h2>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-1">{page.description}</p>
                </div>
              </div>
            </AdminCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
