import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { logAuditEvent, getClientIp } from '../lib/login-security';

/**
 * Media / image upload
 * ---------------------
 * Security-relevant design decisions:
 *
 *  - We NEVER trust the client-declared MIME type or file extension.
 *    `env.IMAGES.info()` inspects the actual image bytes; if the upload
 *    isn't a real, decodable image, this throws and we reject it. This
 *    is what actually prevents "file upload abuse" (e.g. a disguised
 *    script uploaded with a .png extension) -- extension/MIME checks
 *    alone are trivially spoofed.
 *  - Every upload is re-encoded (not just resized) via the Images
 *    binding. Re-encoding strips any embedded payload that isn't valid
 *    pixel data and normalizes the format, which closes off image-based
 *    polyglot file attacks.
 *  - Output filenames are always server-generated random IDs, never
 *    derived from the user-supplied filename -- this is what prevents
 *    path traversal (a filename like "../../config" has no bearing on
 *    the resulting R2 key).
 *  - A hard file-size ceiling is enforced before we ever touch the
 *    Images binding, so we don't spend transform quota/CPU on obviously
 *    oversized uploads.
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_DIMENSION = 2400; // px, longest edge after resize

export const adminMedia = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminMedia.use('*', requireAuth);

adminMedia.post('/upload', async (c) => {
  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: 'File exceeds the 8MB upload limit' }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: 'File is empty' }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();

  // Verify this is a genuine, decodable image regardless of what the
  // client claims. Rejects disguised non-image files outright.
  let metadata: { format: string; fileSize: number; width: number; height: number };
  try {
    const info = await c.env.IMAGES.info(new Response(arrayBuffer).body!);
    // SVG is rejected outright (not just unsupported) because it's a
    // text/XML format that can embed <script> and event-handler
    // attributes -- "resizing" it via the Images binding doesn't
    // sanitize that risk the way re-encoding a raster image does.
    if (!('width' in info)) {
      return c.json({ error: 'SVG images are not supported' }, 400);
    }
    metadata = info;
  } catch {
    return c.json({ error: 'File is not a valid image' }, 400);
  }

  const ALLOWED_FORMATS = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!ALLOWED_FORMATS.has(metadata.format)) {
    return c.json({ error: 'Only PNG, JPG, and WEBP images are supported' }, 400);
  }

  // Resize (only if larger than our max dimension) and re-encode to
  // WEBP for consistent, small output regardless of the input format.
  // Re-encoding is what provides the "automatic image compression" the
  // spec calls for, and also strips any non-pixel data from the file.
  const needsResize = metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION;
  let transformer = c.env.IMAGES.input(new Response(arrayBuffer).body!);
  if (needsResize) {
    transformer = transformer.transform({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'scale-down' });
  }
  const result = await transformer.output({ format: 'image/webp', quality: 82 });
  const outputResponse = result.response();
  const outputBytes = await outputResponse.arrayBuffer();

  const id = crypto.randomUUID();
  const r2Key = `uploads/${id}.webp`;

  await c.env.MEDIA_BUCKET.put(r2Key, outputBytes, {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
  });

  // Build the public URL from this Worker's own configured base URL rather
  // than a hardcoded domain, so it always points at wherever this Worker
  // is actually deployed. Falls back to deriving it from the incoming
  // request's own origin if WORKER_PUBLIC_URL hasn't been set, so uploads
  // still resolve correctly even before that var is configured.
  const workerBaseUrl = (c.env.WORKER_PUBLIC_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
  const publicUrl = `${workerBaseUrl}/media/${r2Key}`;

  await c.env.DB.prepare(
    `INSERT INTO media (id, r2_key, url, filename, content_type, size_bytes, width, height, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `media_${id}`,
      r2Key,
      publicUrl,
      file.name.slice(0, 200),
      'image/webp',
      outputBytes.byteLength,
      needsResize ? MAX_DIMENSION : metadata.width,
      needsResize ? MAX_DIMENSION : metadata.height,
      c.get('userId'),
    )
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'media_uploaded',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { mediaId: id, sizeBytes: outputBytes.byteLength },
  });

  return c.json({ id: `media_${id}`, url: publicUrl }, 201);
});

adminMedia.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT 200').all();
  return c.json(
    results.map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename,
      uploadedAt: r.created_at,
    })),
  );
});

adminMedia.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT r2_key FROM media WHERE id = ?').bind(id).first<{ r2_key: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);

  await c.env.MEDIA_BUCKET.delete(row.r2_key);
  await c.env.DB.prepare('DELETE FROM media WHERE id = ?').bind(id).run();

  return c.body(null, 204);
});

/**
 * Public route that serves images out of R2. Mounted separately (without
 * requireAuth) at /media/* -- see index.ts.
 */
export const mediaServe = new Hono<{ Bindings: Env }>();

mediaServe.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) return c.notFound();

  c.header('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  return c.body(object.body);
});
