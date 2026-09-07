import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { PromoBanner } from './PromoBanner';
import { CookieConsent } from '@/components/common/CookieConsent';
import { ScrollToTop } from '@/components/common/ScrollToTop';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
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
