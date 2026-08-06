export function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-[70vh] bg-[var(--color-surface)]" />
      <div className="container-page py-20 space-y-4">
        <div className="h-8 w-1/3 bg-[var(--color-surface-alt)] rounded" />
        <div className="h-4 w-2/3 bg-[var(--color-surface-alt)] rounded" />
        <div className="h-4 w-1/2 bg-[var(--color-surface-alt)] rounded" />
      </div>
    </div>
  );
}
