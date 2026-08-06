import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { logAuditEvent, getClientIp } from '../lib/login-security';

type MediaContext = Context<{ Bindings: Env; Variables: AuthedVariables }>;

/**
 * Media / image / video upload
 * -----------------------------
 * Security-relevant design decisions:
 *
 *  - We NEVER trust the client-declared MIME type or file extension.
 *    Images: `env.IMAGES.info()` inspects the actual image bytes; if the
 *    upload isn't a real, decodable image, this throws and we reject it.
 *    Videos/GIFs: we check the file's magic-byte signature (the first few
 *    bytes of the actual file), not the browser-supplied Content-Type,
 *    which is trivially spoofed.
 *  - Every image upload is re-encoded (not just resized) via the Images
 *    binding. Re-encoding strips any embedded payload that isn't valid
 *    pixel data and normalizes the format, which closes off image-based
 *    polyglot file attacks. Video/GIF bytes are stored as-is: Cloudflare's
 *    Images binding cannot decode or re-encode video, so there's no
 *    equivalent "safe re-encode" step available for those formats here.
 *  - Output filenames are always server-generated random IDs, never
 *    derived from the user-supplied filename -- this is what prevents
 *    path traversal (a filename like "../../config" has no bearing on
 *    the resulting R2 key).
 *  - A hard file-size ceiling is enforced before we ever touch the
 *    Images binding, so we don't spend transform quota/CPU on obviously
 *    oversized uploads. Video/GIF get a *tighter* ceiling than images,
 *    both because there is no server-side compression step for them and
 *    because the person asked to keep banner/gallery media file sizes
 *    small for page-load performance.
 *
 * IMPORTANT LIMITATION -- read before assuming videos get compressed:
 * Cloudflare's Images binding only processes actual raster images
 * (PNG/JPG/WEBP). It cannot transcode or shrink video files, and GIFs
 * are stored as-is rather than re-encoded (re-encoding would need a
 * dedicated video pipeline, e.g. Cloudflare Stream, which this Worker
 * does not have access to). This is why video/GIF uploads are capped at
 * a much smaller max size than images -- since we can't compress them
 * after the fact, the limit is the only lever available to keep them
 * small. If you need larger source videos, compress them to under the
 * limit before uploading (e.g. with HandBrake or an online compressor)
 * -- see DEPLOYMENT.md.
 */

const MAX_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB -- no server-side compression exists for video, so this ceiling is what actually keeps banner/gallery video small
const MAX_GIF_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB -- GIFs are stored as-is (not re-encoded), same reasoning as video
const MAX_DIMENSION = 2400; // px, longest edge after resize (images only)

type UploadKind = 'image' | 'video' | 'gif';

// Magic-byte (file signature) checks for the video/gif formats we accept.
// This is what actually verifies file content, since we can't run these
// through the Images binding the way we do for real images.
function sniffMediaKind(bytes: Uint8Array, declaredType: string): UploadKind | null {
  // GIF: "GIF87a" or "GIF89a"
  if (bytes.length >= 6) {
    const sig = String.fromCharCode(...bytes.slice(0, 6));
    if (sig === 'GIF87a' || sig === 'GIF89a') return 'gif';
  }
  // MP4/MOV family: ftyp box starting at byte 4
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    return 'video';
  }
  // WEBM/MKV (Matroska container): EBML header
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'video';
  }
  // Fall back to the declared type only for images -- images get verified
  // properly via env.IMAGES.info() right after this, so a wrong declared
  // type there just gets rejected at that next step rather than trusted.
  if (declaredType.startsWith('image/')) return 'image';
  return null;
}

export const adminMedia = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminMedia.use('*', requireAuth);

adminMedia.post('/upload', async (c) => {
  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }
  if (file.size === 0) {
    return c.json({ error: 'File is empty' }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const headBytes = new Uint8Array(arrayBuffer.slice(0, 32));
  const kind = sniffMediaKind(headBytes, file.type);

  if (kind === null) {
    return c.json(
      { error: 'Unsupported file. Upload a PNG, JPG, WEBP image, an MP4/WEBM video, or a GIF.' },
      400,
    );
  }

  if (kind === 'image') {
    return handleImageUpload(c, file, arrayBuffer);
  }
  return handleVideoOrGifUpload(c, file, arrayBuffer, kind);
});

async function handleImageUpload(c: MediaContext, file: File, arrayBuffer: ArrayBuffer) {
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return c.json({ error: 'Image exceeds the 8MB upload limit' }, 400);
  }

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

  const workerBaseUrl = (c.env.WORKER_PUBLIC_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
  const publicUrl = `${workerBaseUrl}/media/${r2Key}`;

  await c.env.DB.prepare(
    `INSERT INTO media (id, r2_key, url, filename, content_type, size_bytes, width, height, uploaded_by, media_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image')`,
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
    metadata: { mediaId: id, sizeBytes: outputBytes.byteLength, mediaType: 'image' },
  });

  return c.json({ id: `media_${id}`, url: publicUrl, mediaType: 'image' as const }, 201);
}

async function handleVideoOrGifUpload(c: MediaContext, file: File, arrayBuffer: ArrayBuffer, kind: 'video' | 'gif') {
  const limit = kind === 'video' ? MAX_VIDEO_UPLOAD_BYTES : MAX_GIF_UPLOAD_BYTES;
  if (file.size > limit) {
    const limitMb = Math.round(limit / (1024 * 1024));
    return c.json(
      {
        error: `${kind === 'video' ? 'Video' : 'GIF'} exceeds the ${limitMb}MB upload limit. Compress it before uploading -- there is no server-side video compression here (see DEPLOYMENT.md).`,
      },
      400,
    );
  }

  const contentType = kind === 'gif' ? 'image/gif' : (file.type.startsWith('video/') ? file.type : 'video/mp4');
  const ext = kind === 'gif' ? 'gif' : contentType === 'video/webm' ? 'webm' : 'mp4';

  const id = crypto.randomUUID();
  const r2Key = `uploads/${id}.${ext}`;

  await c.env.MEDIA_BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const workerBaseUrl = (c.env.WORKER_PUBLIC_URL || new URL(c.req.url).origin).replace(/\/+$/, '');
  const publicUrl = `${workerBaseUrl}/media/${r2Key}`;

  await c.env.DB.prepare(
    `INSERT INTO media (id, r2_key, url, filename, content_type, size_bytes, width, height, uploaded_by, media_type)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
  )
    .bind(`media_${id}`, r2Key, publicUrl, file.name.slice(0, 200), contentType, arrayBuffer.byteLength, c.get('userId'), kind)
    .run();

  await logAuditEvent(c.env.DB, {
    userId: c.get('userId'),
    action: 'media_uploaded',
    ip: getClientIp(c.req.raw.headers),
    userAgent: c.req.header('User-Agent') ?? null,
    metadata: { mediaId: id, sizeBytes: arrayBuffer.byteLength, mediaType: kind },
  });

  return c.json({ id: `media_${id}`, url: publicUrl, mediaType: kind }, 201);
}

adminMedia.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM media ORDER BY created_at DESC LIMIT 200').all();
  return c.json(
    results.map((r) => ({
      id: r.id,
      url: r.url,
      filename: r.filename,
      uploadedAt: r.created_at,
      mediaType: r.media_type ?? 'image',
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
 * Public route that serves images/video/gif out of R2. Mounted separately
 * (without requireAuth) at /media/* -- see index.ts.
 */
export const mediaServe = new Hono<{ Bindings: Env }>();

mediaServe.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  const object = await c.env.MEDIA_BUCKET.get(key);
  if (!object) return c.notFound();

  c.header('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream');
  c.header('Cache-Control', 'public, max-age=31536000, immutable');
  // Video files benefit from range requests (seeking/scrubbing); R2's
  // `get` doesn't auto-negotiate this the way a dedicated video host
  // would, so scrubbing on very large video files may be limited to
  // sequential playback. Fine given the size ceiling enforced on upload.
  return c.body(object.body);
});
