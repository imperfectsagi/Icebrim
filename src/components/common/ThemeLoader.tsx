import { useEffect } from 'react';
import { useThemeSettings } from '@/hooks/useContent';

/**
 * Applies the brand accent color saved in Admin > Branding to the
 * document root as CSS variable overrides. Because every "orange"
 * button, active nav link, focus ring, and coral-tinted surface in the
 * app reads from --color-coral / --color-coral-deep / --color-coral-tint
 * (see src/index.css), overriding those three variables here re-colors
 * the whole site -- public pages and admin panel alike -- from one
 * saved value, with no per-component changes required.
 *
 * Renders nothing. Mounted once near the root in App.tsx.
 */
export function ThemeLoader() {
  const { data } = useThemeSettings();

  useEffect(() => {
    if (!data?.accentColor) return;
    const root = document.documentElement;
    const { base, deep, tint } = deriveShades(data.accentColor);
    root.style.setProperty('--color-coral', base);
    root.style.setProperty('--color-coral-deep', deep);
    root.style.setProperty('--color-coral-tint', tint);
  }, [data?.accentColor]);

  return null;
}

/**
 * Derives a darker "deep" shade (for hover/text-on-light use) and a
 * pale "tint" shade (for subtle backgrounds) from a single admin-picked
 * hex color, so picking one color still yields a coherent 3-step scale
 * instead of requiring the admin to pick three related colors by eye.
 */
function deriveShades(hex: string): { base: string; deep: string; tint: string } {
  const { r, g, b } = hexToRgb(hex);
  const deep = rgbToHex(mix(r, g, b, 0, 0, 0, 0.18));
  const tint = rgbToHex(mix(r, g, b, 255, 255, 255, 0.85));
  return { base: hex, deep, tint };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function mix(r: number, g: number, b: number, tr: number, tg: number, tb: number, amount: number): {
  r: number;
  g: number;
  b: number;
} {
  return {
    r: Math.round(r + (tr - r) * amount),
    g: Math.round(g + (tg - g) * amount),
    b: Math.round(b + (tb - b) * amount),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
