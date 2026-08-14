import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = 'No records yet.',
  rowActions,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowActions?: (row: T) => ReactNode;
  /** If provided, rows become clickable (e.g. to navigate to a detail page). Clicks on rowActions still work independently since those are separate elements. */
  onRowClick?: (row: T) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] p-10 text-center text-sm text-[var(--color-ink-soft)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[var(--radius-card)] border border-[var(--color-line)] overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-left">
            {columns.map((col) => (
              <th key={col.header} className="px-5 py-3 font-semibold text-[var(--color-ink-soft)] whitespace-nowrap">
                {col.header}
              </th>
            ))}
            {rowActions && <th className="px-5 py-3" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface)]',
                onRowClick && 'cursor-pointer',
              )}
            >
              {columns.map((col) => (
                <td key={col.header} className={col.className ?? 'px-5 py-3'}>
                  {col.accessor(row)}
                </td>
              ))}
              {rowActions && <td className="px-5 py-3 text-right whitespace-nowrap">{rowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
