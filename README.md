# Icebrim

A production-ready company website with a fully custom CMS/admin panel, built with React + Vite + TypeScript on the frontend and Cloudflare Workers + D1 + R2 on the backend.

## Project structure

```
icebrim/
├── src/                    # Frontend (React + Vite + TypeScript)
│   ├── components/         # UI primitives, layout, sections, common
│   ├── features/           # Feature modules (home, admin)
│   ├── pages/               # Route-level pages
│   ├── hooks/               # Data-fetching hooks (React Query)
│   ├── data/                 # Local seed content (dev fallback)
│   ├── types/                 # Shared CMS type definitions
│   └── lib/                    # Utilities, API client
├── public/                  # Static assets (logo, images, robots.txt)
└── workers/                 # Backend (Cloudflare Workers + Hono + D1 + R2)
    ├── src/
    │   ├── routes/           # API route handlers
    │   ├── middleware/       # Auth middleware
    │   └── lib/                # JWT, password hashing, validation, security
    ├── db/
    │   ├── migrations/       # D1 schema migrations
    │   └── seed-data/        # Generated seed content
    └── scripts/               # Admin bootstrap script
```

## Prerequisites

- Node.js 20+
- A Cloudflare account (free tier is sufficient to start)
- `npx wrangler login` completed once, to authenticate the CLI

## 1. Backend setup (Cloudflare Workers)

```bash
cd workers
npm install

# Create your D1 database and note the returned database_id
npx wrangler d1 create icebrim-db
# Paste the database_id into wrangler.toml under [[d1_databases]]

# Create your R2 bucket for media storage
npx wrangler r2 bucket create icebrim-media

# Run migrations
npm run db:migrate:local    # for local dev
npm run db:migrate:remote   # for production, once ready

# Seed initial content (categories, sample product, home page content)
npx wrangler d1 execute icebrim-db --local --file=db/seed.sql
npx wrangler d1 execute icebrim-db --local --file=db/seed-data/home-content.sql
```

### Secrets

```bash
npx wrangler secret put JWT_ACCESS_SECRET      # openssl rand -base64 48
npx wrangler secret put JWT_REFRESH_SECRET     # different random value
npx wrangler secret put TURNSTILE_SECRET_KEY   # from your Turnstile widget
```

See `workers/.env.example` for what each secret is for.

### Create your first admin user

```bash
npm run create-admin:local -- myusername me@icebrim.com "a-strong-password-12plus-chars"
```

### Run the backend locally

```bash
npm run dev
```

This starts the API on http://localhost:8787.

### Deploy

```bash
npm run deploy
```

## 2. Frontend setup

```bash
cd ..
npm install
cp .env.example .env.local
```

Set `VITE_API_BASE_URL` in `.env.local` to your deployed Worker URL (e.g. `https://icebrim-api.yoursubdomain.workers.dev`). Leave it empty to develop against local seed data with no backend running.

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name=icebrim
```

Or connect the repository directly in the Cloudflare dashboard (Pages, Create a project, Connect to Git), with:
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `VITE_API_BASE_URL` set to your Worker's URL

The `public/_redirects` file is already configured for SPA client-side routing.

## Architecture notes

- **CMS content** (home page sections, company settings) is stored as JSON blobs in D1's `site_content` table, keyed by section. This keeps adding new editable fields simple with no migration needed, while structured entities like products, blog posts, and reviews get proper relational tables.
- **Auth** uses short-lived (15 minute) JWT access tokens plus longer-lived opaque refresh tokens, both in HttpOnly/Secure/SameSite=Strict cookies. Password hashing uses PBKDF2-SHA256 via Web Crypto, since Workers can't run native bcrypt/argon2. See `workers/src/lib/password.ts` for the reasoning and an Argon2id upgrade path.
- **Images** are uploaded through the Cloudflare Images binding, which verifies real image bytes rather than just the declared MIME type, strips non-pixel data, resizes, and re-encodes to WEBP before storing in R2.
- **Rate limiting** uses Cloudflare's native Rate Limiting binding for login attempts and form submissions, layered with account-level and IP-level lockout tracked in D1.
- The frontend's data hooks in `src/hooks/useContent.ts` fall back to local seed data when `VITE_API_BASE_URL` is unset, so the site and admin panel are both fully clickable without a deployed backend during early development.

## Admin panel

Once deployed, sign in at `/admin/login` with the credentials created via `create-admin`. The admin panel is a separate route tree with no public header or footer, and its JS bundle is only loaded when visiting `/admin/*`. 
