import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { PageSkeleton } from '@/components/common/PageSkeleton';
import { MaintenanceGate } from '@/components/common/MaintenanceGate';
import { CartDrawer } from '@/features/cart/CartDrawer';

const HomePage = lazy(() => import('@/features/home/HomePage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ProductsPage = lazy(() => import('@/pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const BlogPage = lazy(() => import('@/pages/BlogPage'));
const BlogDetailPage = lazy(() => import('@/pages/BlogDetailPage'));
const GalleryPage = lazy(() => import('@/pages/GalleryPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('@/pages/OrderConfirmationPage'));
const OrderStatusPage = lazy(() => import('@/pages/OrderStatusPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const CookiePolicyPage = lazy(() => import('@/pages/CookiePolicyPage'));
const CustomPage = lazy(() => import('@/pages/CustomPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AdminApp = lazy(() => import('@/features/admin/AdminApp'));

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <MaintenanceGate>
        <>
          <Layout />
          <CartDrawer />
        </>
      </MaintenanceGate>
    ),
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'about', element: withSuspense(<AboutPage />) },
      { path: 'products', element: withSuspense(<ProductsPage />) },
      {
        path: 'products/:slug',
        element: withSuspense(<ProductDetailPage />),
      },
      { path: 'blog', element: withSuspense(<BlogPage />) },
      {
        path: 'blog/:slug',
        element: withSuspense(<BlogDetailPage />),
      },
      { path: 'gallery', element: withSuspense(<GalleryPage />) },
      { path: 'contact', element: withSuspense(<ContactPage />) },
      { path: 'checkout', element: withSuspense(<CheckoutPage />) },
      {
        path: 'order-confirmation',
        element: withSuspense(<OrderConfirmationPage />),
      },
      {
        path: 'order-status',
        element: withSuspense(<OrderStatusPage />),
      },
      {
        path: 'privacy-policy',
        element: withSuspense(<PrivacyPolicyPage />),
      },
      { path: 'terms', element: withSuspense(<TermsPage />) },
      {
        path: 'cookie-policy',
        element: withSuspense(<CookiePolicyPage />),
      },
      // Admin-managed custom pages (Admin -> Pages) resolve directly by
      // their own slug -- e.g. a page with slug "faq" is served at
      // /faq, not /pages/faq. This route only matches paths that didn't
      // match anything above, so it can never shadow a real static
      // route (see reservedSlugs in workers/src/lib/schemas.ts, which
      // rejects an admin from saving a page with a slug that collides
      // with one of the fixed paths in this file). CustomPage.tsx 404s
      // via NotFoundPage itself if no published page matches the slug,
      // so this doubles as the catch-all that path: '*' used to be.
      {
        path: ':slug',
        element: withSuspense(<CustomPage />),
      },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
  {
    path: '/admin/*',
    element: withSuspense(<AdminApp />),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}