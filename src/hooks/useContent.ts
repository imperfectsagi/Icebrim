import { useQuery } from '@tanstack/react-query';
import { api, hasLiveApi } from '@/lib/api-client';
import type { HomePageContent, CompanySettings, Product, BlogPost, Review, GalleryImage } from '@/types/cms';
import { homeContent } from '@/data/home';
import { companySettings } from '@/data/company';
import { products } from '@/data/products';
import { blogPosts } from '@/data/blog';
import { reviews } from '@/data/reviews';

/**
 * Content hooks
 * -------------
 * Each hook fetches from the live Workers API when VITE_API_BASE_URL is
 * configured, and falls back to local seed data otherwise. This lets the
 * frontend team build and preview pages before the backend exists, and
 * lets the Admin Panel and public site share the exact same data-fetching
 * contract once it does.
 */

export function useHomeContent() {
  return useQuery<HomePageContent>({
    queryKey: ['content', 'home'],
    queryFn: () => (hasLiveApi ? api.get('/api/content/home') : Promise.resolve(homeContent)),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanySettings() {
  return useQuery<CompanySettings>({
    queryKey: ['content', 'company'],
    queryFn: () => (hasLiveApi ? api.get('/api/content/company') : Promise.resolve(companySettings)),
    staleTime: 5 * 60 * 1000,
  });
}

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => (hasLiveApi ? api.get('/api/products') : Promise.resolve(products)),
    staleTime: 60 * 1000,
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery<Product | undefined>({
    queryKey: ['products', slug],
    enabled: !!slug,
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/products/${slug}`)
        : Promise.resolve(products.find((p) => p.slug === slug)),
    staleTime: 60 * 1000,
  });
}

export function useBlogPosts() {
  return useQuery<BlogPost[]>({
    queryKey: ['blog'],
    queryFn: () =>
      hasLiveApi
        ? api.get('/api/blog')
        : Promise.resolve(blogPosts.filter((p) => p.status === 'published')),
    staleTime: 60 * 1000,
  });
}

export function useBlogPost(slug: string | undefined) {
  return useQuery<BlogPost | undefined>({
    queryKey: ['blog', slug],
    enabled: !!slug,
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/blog/${slug}`)
        : Promise.resolve(blogPosts.find((p) => p.slug === slug)),
    staleTime: 60 * 1000,
  });
}

export function useApprovedReviews(productSlug?: string) {
  return useQuery<Review[]>({
    queryKey: ['reviews', productSlug ?? 'all'],
    queryFn: () =>
      hasLiveApi
        ? api.get(`/api/reviews${productSlug ? `?product=${productSlug}` : ''}`)
        : Promise.resolve(
            reviews.filter(
              (r) => r.status === 'approved' && (!productSlug || r.productSlug === productSlug),
            ),
          ),
    staleTime: 60 * 1000,
  });
}

export function useThemeSettings() {
  return useQuery<{ accentColor: string }>({
    queryKey: ['settings', 'theme'],
    queryFn: () =>
      hasLiveApi ? api.get('/api/settings/theme') : Promise.resolve({ accentColor: '#ff6b5b' }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMaintenanceStatus() {
  return useQuery<{ maintenanceMode: boolean; maintenanceMessage: string }>({
    queryKey: ['settings', 'maintenance'],
    queryFn: () =>
      hasLiveApi
        ? api.get('/api/settings/maintenance')
        : Promise.resolve({ maintenanceMode: false, maintenanceMessage: '' }),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useGalleryImages() {
  return useQuery<GalleryImage[]>({
    queryKey: ['gallery'],
    queryFn: () => (hasLiveApi ? api.get('/api/gallery') : Promise.resolve(fallbackGallery)),
    staleTime: 60 * 1000,
  });
}

const fallbackGallery: GalleryImage[] = [
  {
    id: 'g1',
    src: '/assets/products/cooling-relief-cap/hero-lifestyle.jpg',
    alt: 'Icebrim Cooling Relief Cap in use at home',
    category: 'Lifestyle',
  },
  {
    id: 'g2',
    src: '/assets/products/twin-pack/hero.jpg',
    alt: 'Icebrim Rotation Twin Pack packaging',
    category: 'Product',
  },
];
