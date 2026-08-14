/**
 * Shared color-derivation helpers.
 *
 * Single source of truth for turning one admin-picked hex color into a
 * coherent 3-step scale (base / deep-hover / pale-tint). Previously this
 * logic existed in two places (a dead `src/lib/theme.ts` with zero
 * importers, and duplicated inline math inside `ThemeLoader.tsx`) with
 * slightly different mix ratios that could silently diverge if extended --
 * see FIX-010 in the repair plan. This is now the only implementation.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1]!, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes a color toward black (amount 0-1) to produce a darker "hover/deep" shade. */
export function darken(rgb: Rgb, amount: number): Rgb {
  return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
}

/** Mixes a color toward white (amount 0-1) to produce a pale "tint" background. */
export function lighten(rgb: Rgb, amount: number): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

export function isValidHexColor(value: string): boolean {
  return hexToRgb(value) !== null;
}

/** Derives { base, deep, tint } shades from a single admin-picked hex color. */
export function deriveShades(hex: string): { base: string; deep: string; tint: string } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { base: hex, deep: hex, tint: hex };
  return {
    base: hex,
    deep: rgbToHex(darken(rgb, 0.18)),
    tint: rgbToHex(lighten(rgb, 0.87)),
  };
}

export const DEFAULT_ACCENT_COLOR = '#11534E';
