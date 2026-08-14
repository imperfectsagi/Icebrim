import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminProductFormPage } from './pages/AdminProductFormPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminBlogsPage } from './pages/AdminBlogsPage';
import { AdminBlogFormPage } from './pages/AdminBlogFormPage';
import { AdminPagesPage } from './pages/AdminPagesPage';
import { AdminPageFormPage } from './pages/AdminPageFormPage';
import { AdminReviewsPage } from './pages/AdminReviewsPage';
import { AdminMediaPage } from './pages/AdminMediaPage';
import { AdminGalleryPage } from './pages/AdminGalleryPage';
import { AdminBannerPage } from './pages/AdminBannerPage';
import { AdminPoliciesPage } from './pages/AdminPoliciesPage';
import { AdminPolicyFormPage } from './pages/AdminPolicyFormPage';
import { AdminCouponsPage } from './pages/AdminCouponsPage';
import { AdminCompanySettingsPage } from './pages/AdminCompanySettingsPage';
import { AdminBrandingPage } from './pages/AdminBrandingPage';
import { AdminPromoBannerPage } from './pages/AdminPromoBannerPage';
import { AdminSeoSettingsPage } from './pages/AdminSeoSettingsPage';
import { AdminMessagesPage } from './pages/AdminMessagesPage';
import { AdminOrdersPage } from './pages/AdminOrdersPage';
import { AdminOrderDetailPage } from './pages/AdminOrderDetailPage';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminSystemSettingsPage } from './pages/AdminSystemSettingsPage';
import { RequireAuth } from './auth/RequireAuth';
import { AuthProvider } from './auth/AuthContext';

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/:id" element={<AdminProductFormPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="blogs" element={<AdminBlogsPage />} />
          <Route path="blogs/:id" element={<AdminBlogFormPage />} />
          <Route path="pages" element={<AdminPagesPage />} />
          <Route path="pages/:id" element={<AdminPageFormPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="media" element={<AdminMediaPage />} />
          <Route path="gallery" element={<AdminGalleryPage />} />
          <Route path="banner" element={<AdminBannerPage />} />
          <Route path="policies" element={<AdminPoliciesPage />} />
          <Route path="policies/:key" element={<AdminPolicyFormPage />} />
          <Route path="coupons" element={<AdminCouponsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="settings/company" element={<AdminCompanySettingsPage />} />
          <Route path="settings/branding" element={<AdminBrandingPage />} />
          <Route path="settings/promo-banner" element={<AdminPromoBannerPage />} />
          <Route path="settings/seo" element={<AdminSeoSettingsPage />} />
          <Route path="settings/system" element={<AdminSystemSettingsPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
