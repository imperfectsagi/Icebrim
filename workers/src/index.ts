import { Hono } from 'hono';
import type { Env } from './lib/env';
import type { AuthedVariables } from './middleware/auth';

import authRoutes from './routes/auth';
import contentRoutes from './routes/content';
import productRoutes, { adminProducts } from './routes/products';
import blogRoutes, { adminBlog } from './routes/blog';
import reviewRoutes, { adminReviews } from './routes/reviews';
import contactRoutes, { adminMessages, newsletter } from './routes/contact';
import { adminMedia, mediaServe } from './routes/media';
import { adminCategories, gallery, adminGallery } from './routes/categories-gallery';
import { adminContent, adminSettings, publicSettings } from './routes/admin-content';
import { adminUsers } from './routes/admin-users';
import { adminDashboard } from './routes/admin-dashboard';
import { sitemap } from './routes/sitemap';
import { getClientIp } from './lib/login-security';
import { parseAllowedOrigins, isOriginAllowed } from './lib/cors';

const app = new Hono<{ Bindings: Env; Variables: Partial<AuthedVariables> }>();

app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = parseAllowedOrigins(c.env.PUBLIC_SITE_URL);

  if (isOriginAllowed(origin, allowedOrigins)) {
    c.header('Access-Control-Allow-Origin', origin ?? '');
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
    c.header('Vary', 'Origin');
  }

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }

  await next();
});

app.use('/api/admin/auth/login', async (c, next) => {
  const ip = getClientIp(c.req.raw.headers);
  const result = await c.env.LOGIN_RATE_LIMITER.limit({ key: `login:${ip}` });
  if (!result.success) {
    return c.json({ error: 'Too many login attempts. Please try again shortly.' }, 429);
  }
  await next();
});

app.route('/api/content', contentRoutes);
app.route('/api/products', productRoutes);
app.route('/api/blog', blogRoutes);
app.route('/api/reviews', reviewRoutes);
app.route('/api/contact', contactRoutes);
app.route('/api/newsletter', newsletter);
app.route('/api/gallery', gallery);
app.route('/api/settings', publicSettings);
app.route('/media', mediaServe);
app.route('/', sitemap);

app.route('/api/admin/auth', authRoutes);
app.route('/api/admin/products', adminProducts);
app.route('/api/admin/blog', adminBlog);
app.route('/api/admin/reviews', adminReviews);
app.route('/api/admin/messages', adminMessages);
app.route('/api/admin/media', adminMedia);
app.route('/api/admin/categories', adminCategories);
app.route('/api/admin/gallery', adminGallery);
app.route('/api/admin/content', adminContent);
app.route('/api/admin/settings', adminSettings);
app.route('/api/admin/users', adminUsers);
app.route('/api/admin/dashboard', adminDashboard);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
