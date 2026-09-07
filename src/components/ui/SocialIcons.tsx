import type { SVGProps } from 'react';

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M14 9h2.5V6.2h-2.5C12 6.2 11 7.3 11 9.4V11H9v3h2v7h3v-7h2.3l.4-3H14V9.7c0-.5.2-.7.7-.7Z" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.5 3v9.6a3.9 3.9 0 1 1-3.9-3.9c.3 0 .6.02.9.07" />
      <path d="M16.5 3c.2 2.2 1.9 3.9 4 4.1" />
    </svg>
  );
}
