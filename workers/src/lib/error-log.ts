type ErrorCategory = 'general' | 'payment' | 'webhook' | 'auth';

interface LogErrorParams {
  category?: ErrorCategory;
  message: string;
  stack?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Persists an error to D1's `error_log` table (see migration
 * 0005_error_log.sql) so production issues -- especially payment/webhook
 * ones, per FIX-034's priority -- are discoverable by querying D1 rather
 * than requiring someone to have been live-tailing the Worker at the
 * exact moment something broke.
 *
 * Never throws. A logging failure (e.g. D1 is down) must never mask or
 * replace the original error/response the caller is already handling --
 * this is a side effect, not something the request's success should ever
 * depend on.
 */
export async function logError(db: D1Database, params: LogErrorParams): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO error_log (id, category, message, stack, method, path, status_code, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `err_${crypto.randomUUID()}`,
        params.category ?? 'general',
        params.message.slice(0, 2000),
        params.stack?.slice(0, 4000) ?? null,
        params.method ?? null,
        params.path ?? null,
        params.statusCode ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      )
      .run();
  } catch (loggingError) {
    // Deliberately just console.error here rather than re-throwing --
    // see the docstring above. If D1 itself is unreachable, the original
    // error is still what matters; this is a best-effort secondary path.
    console.error('Failed to persist error to error_log:', loggingError);
  }
}

/** Convenience wrapper for the payment/webhook paths FIX-034 explicitly calls out as highest-value to never lose silently. */
export async function logPaymentError(
  db: D1Database,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return logError(db, { category: 'payment', message, metadata });
}
