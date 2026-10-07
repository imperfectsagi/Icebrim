/**
 * System settings (Admin > System Settings): maintenance mode and the admin
 * inactivity timeout. Stored as one JSON document in site_content under the
 * key "system_settings", like the other site-wide settings.
 *
 * Everything that needs to know "is the site in maintenance?" or "how long
 * may an admin session sit idle?" goes through this file so there is exactly
 * one definition of both -- the public maintenance endpoint, the API-level
 * maintenance guard (index.ts) and the admin auth middleware all agree.
 */

export const DEFAULT_MAINTENANCE_MESSAGE = "We're making some improvements. Please check back shortly.";
export const DEFAULT_SESSION_TIMEOUT_MINUTES = 15;
export const MIN_SESSION_TIMEOUT_MINUTES = 5;
export const MAX_SESSION_TIMEOUT_MINUTES = 1440; // 24 hours
export const MAX_MAINTENANCE_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  /** Expected length of the maintenance window in whole days. 0 = no estimate. */
  maintenanceDurationDays: number;
  /** When true, maintenance switches itself off once the days have elapsed. When false it stays on until an admin switches it off. */
  maintenanceAutoEnd: boolean;
  /** Set by the server when maintenance is switched on. */
  maintenanceStartedAt: string | null;
  /** maintenanceStartedAt + maintenanceDurationDays (null when no duration). */
  maintenanceEndsAt: string | null;
  sessionTimeoutMinutes: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  maintenanceMessage: '',
  maintenanceDurationDays: 0,
  maintenanceAutoEnd: false,
  maintenanceStartedAt: null,
  maintenanceEndsAt: null,
  sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function validIso(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

/**
 * Turns whatever is stored (possibly the older three-field shape, possibly
 * null) into a complete, valid SystemSettings object.
 */
export function normalizeSystemSettings(raw: unknown): SystemSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    maintenanceMode: r.maintenanceMode === true,
    maintenanceMessage: typeof r.maintenanceMessage === 'string' ? r.maintenanceMessage : '',
    maintenanceDurationDays: clampInt(r.maintenanceDurationDays, 0, MAX_MAINTENANCE_DAYS, 0),
    maintenanceAutoEnd: r.maintenanceAutoEnd === true,
    maintenanceStartedAt: validIso(r.maintenanceStartedAt),
    maintenanceEndsAt: validIso(r.maintenanceEndsAt),
    sessionTimeoutMinutes: clampInt(
      r.sessionTimeoutMinutes,
      MIN_SESSION_TIMEOUT_MINUTES,
      MAX_SESSION_TIMEOUT_MINUTES,
      DEFAULT_SESSION_TIMEOUT_MINUTES,
    ),
  };
}

/**
 * Whether visitors should currently see the maintenance page. Maintenance
 * stays on until an admin switches it off -- unless the admin ticked "end
 * automatically" AND set a number of days, in which case it ends by itself
 * when that time is up.
 */
export function isMaintenanceActive(settings: SystemSettings, now: number = Date.now()): boolean {
  if (!settings.maintenanceMode) return false;
  if (settings.maintenanceAutoEnd && settings.maintenanceEndsAt && Date.parse(settings.maintenanceEndsAt) <= now) {
    return false;
  }
  return true;
}

/**
 * Applies an admin's save on top of the previously stored settings.
 * The server (not the browser) owns the start/end timestamps so they can't
 * drift with the admin's device clock:
 *   - switching maintenance ON starts the clock;
 *   - editing while it is already ON keeps the original start (so changing
 *     the number of days moves the end date, it doesn't restart the window);
 *   - switching it OFF clears both timestamps.
 */
export function applySystemSettingsUpdate(
  previous: SystemSettings,
  input: Pick<
    SystemSettings,
    'maintenanceMode' | 'maintenanceMessage' | 'maintenanceDurationDays' | 'maintenanceAutoEnd' | 'sessionTimeoutMinutes'
  >,
  now: number = Date.now(),
): SystemSettings {
  const wasActive = isMaintenanceActive(previous, now);
  let startedAt: string | null = null;
  let endsAt: string | null = null;

  if (input.maintenanceMode) {
    startedAt = wasActive && previous.maintenanceStartedAt ? previous.maintenanceStartedAt : new Date(now).toISOString();
    if (input.maintenanceDurationDays > 0) {
      endsAt = new Date(Date.parse(startedAt) + input.maintenanceDurationDays * DAY_MS).toISOString();
    }
  }

  return {
    maintenanceMode: input.maintenanceMode,
    maintenanceMessage: input.maintenanceMessage.trim(),
    maintenanceDurationDays: input.maintenanceDurationDays,
    maintenanceAutoEnd: input.maintenanceAutoEnd,
    maintenanceStartedAt: startedAt,
    maintenanceEndsAt: endsAt,
    sessionTimeoutMinutes: input.sessionTimeoutMinutes,
  };
}

export async function getSystemSettings(db: D1Database): Promise<SystemSettings> {
  const row = await db.prepare(`SELECT value FROM site_content WHERE key = 'system_settings'`).first<{ value: string }>();
  if (!row) return { ...DEFAULT_SYSTEM_SETTINGS };
  try {
    return normalizeSystemSettings(JSON.parse(row.value));
  } catch {
    return { ...DEFAULT_SYSTEM_SETTINGS };
  }
}
