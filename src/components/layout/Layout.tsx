import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { PromoBanner } from './PromoBanner';
import { CookieConsent } from '@/components/common/CookieConsent';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <PromoBanner />
      <Header />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieConsent />
    </div>
  );
}
