import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely, resolving conflicting utility classes. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as GBP currency, e.g. 34.99 -> "£34.99". */
export function formatPrice(amount: number, currency: string = 'GBP') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(amount);
}

/** Percentage saved between an original price and a discounted offer price. */
export function percentOff(original: number, offer: number) {
  if (original <= 0) return 0;
  return Math.round(((original - offer) / original) * 100);
}

/** Format an ISO date string as a readable UK-style date. */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
