import { Children, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/** 1 column on phones, 2 on tablets, 3 on desktops. */
function getColumnCount(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 3;
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 640px)').matches) return 2;
  return 1;
}

function useColumnCount(maxColumns: number): number {
  const [columns, setColumns] = useState(getColumnCount);

  useEffect(() => {
    const update = () => setColumns(getColumnCount());
    const queries = [window.matchMedia('(min-width: 640px)'), window.matchMedia('(min-width: 1024px)')];
    queries.forEach((q) => q.addEventListener('change', update));
    update();
    return () => queries.forEach((q) => q.removeEventListener('change', update));
  }, []);

  return Math.max(1, Math.min(columns, maxColumns));
}

/**
 * Masonry layout for cards of different heights (for example reviews with a
 * video, photos or a long text).
 *
 * A plain CSS grid makes every card in a row as tall as the tallest one, which
 * leaves a large blank space under the shorter cards. Here each column is its
 * own stack, so every card is exactly as tall as its content and the next card
 * sits directly beneath it. Items are dealt out left-to-right, row by row, so
 * the reading order (newest first) is preserved and does not jump around when
 * more items are added with "Show more".
 */
export function MasonryGrid({
  children,
  className,
  maxColumns = 3,
}: {
  children: ReactNode;
  className?: string;
  maxColumns?: number;
}) {
  const columnCount = useColumnCount(maxColumns);
  const items = Children.toArray(children);

  const columns: ReactNode[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount]!.push(item);
  });

  return (
    <div className={['flex items-start gap-5', className].filter(Boolean).join(' ')}>
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-5">
          {column}
        </div>
      ))}
    </div>
  );
}
