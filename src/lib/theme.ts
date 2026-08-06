/**
 * Derives the full accent color palette (base, deep/hover, and pale tint)
 * from a single admin-chosen hex color, then applies it as CSS variable
 * overrides on <html>. Every component in the app reads color from
 * var(--color-coral) / var(--color-coral-deep) / var(--color-coral-tint)
 * rather than hardcoded hex values, so overriding these three variables
 * re-colors buttons, links, active nav state, and focus rings everywhere
 * at once -- no per-component changes needed.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes a color toward black (amount 0-1) to produce a darker "hover/deep" shade. */
function darken(rgb: Rgb, amount: number): Rgb {
  return { r: rgb.r * (1 - amount), g: rgb.g * (1 - amount), b: rgb.b * (1 - amount) };
}

/** Mixes a color toward white (amount 0-1) to produce a pale "tint" background. */
function lighten(rgb: Rgb, amount: number): Rgb {
  return {
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  };
}

export function isValidHexColor(value: string): boolean {
  return hexToRgb(value) !== null;
}

/** Applies an accent color as CSS variable overrides on the document root. */
export function applyAccentColor(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;

  const root = document.documentElement;
  root.style.setProperty('--color-coral', rgbToHex(rgb));
  root.style.setProperty('--color-coral-deep', rgbToHex(darken(rgb, 0.15)));
  root.style.setProperty('--color-coral-tint', rgbToHex(lighten(rgb, 0.87)));
}

export const DEFAULT_ACCENT_COLOR = '#ff6b5b';
