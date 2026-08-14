import type { Env } from './lib/env';
import { releaseExpiredReservations } from './routes/orders';

/**
 * Runs on Cloudflare's Cron Triggers (see wrangler.toml [triggers]).
 * Releases stock reservations for any pending order whose reservation
 * window expired without payment completing -- see RESERVATION_MINUTES
 * in routes/orders.ts. This is also attempted opportunistically at the
 * start of every checkout, but relying on that alone means reservations
 * only get cleaned up when someone happens to be checking out at the
 * time; this cron ensures it happens regardless of traffic.
 */
export async function handleScheduled(env: Env): Promise<void> {
  const released = await releaseExpiredReservations(env.DB);
  if (released > 0) {
    console.log(`Released ${released} expired stock reservation(s)`);
  }
}
