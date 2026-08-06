import { Hono } from 'hono';
import type { Env } from '../lib/env';
import type { AuthedVariables } from '../middleware/auth';
import { requireAuth } from '../middleware/auth';
import { contactMessageSchema, newsletterSchema } from '../lib/schemas';
import { getClientIp } from '../lib/login-security';

const contact = new Hono<{ Bindings: Env }>();

contact.post('/', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `contact:${ip}` });
  if (!rateLimitResult.success) {
    return c.json({ error: 'Too many messages sent. Please try again later.' }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = contactMessageSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid message' }, 400);
  const input = parsed.data;

  if (input.companyWebsite) {
    return c.json({ success: true }, 201);
  }

  const id = `msg_${crypto.randomUUID()}`;
  await c.env.DB.prepare(
    `INSERT INTO contact_messages (id, name, email, phone, subject, message, read, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
  )
    .bind(id, input.name, input.email, input.phone ?? null, input.subject, input.message, ip)
    .run();

  return c.json({ success: true, id }, 201);
});

export const adminMessages = new Hono<{ Bindings: Env; Variables: AuthedVariables }>();
adminMessages.use('*', requireAuth);

interface MessageRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  read: number;
  created_at: string;
}

adminMessages.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all<MessageRow>();
  return c.json(
    results.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone ?? undefined,
      subject: r.subject,
      message: r.message,
      read: !!r.read,
      createdAt: r.created_at,
    })),
  );
});

adminMessages.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const read = typeof (body as { read?: unknown }).read === 'boolean' ? (body as { read: boolean }).read : true;
  await c.env.DB.prepare('UPDATE contact_messages SET read = ? WHERE id = ?').bind(read ? 1 : 0, id).run();
  return c.json({ success: true });
});

adminMessages.delete('/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM contact_messages WHERE id = ?').bind(c.req.param('id')).run();
  return c.body(null, 204);
});

export const newsletter = new Hono<{ Bindings: Env }>();

newsletter.post('/', async (c) => {
  const ip = getClientIp(c.req.raw.headers);
  const rateLimitResult = await c.env.FORM_RATE_LIMITER.limit({ key: `newsletter:${ip}` });
  if (!rateLimitResult.success) return c.json({ error: 'Too many attempts. Please try again later.' }, 429);

  const body = await c.req.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Enter a valid email address' }, 400);

  await c.env.DB.prepare(
    `INSERT INTO newsletter_subscribers (id, email) VALUES (?, ?)
     ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL`,
  )
    .bind(`sub_${crypto.randomUUID()}`, parsed.data.email)
    .run();

  return c.json({ success: true }, 201);
});

export default contact;
