/** Shown inside the app shell while a page's data loads. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <span className="sr-only">Loading…</span>
      <div className="skeleton" style={{ height: 104 }} />
      <div className="skeleton" style={{ height: 92 }} />
      <div className="grid-2">
        <div className="skeleton" style={{ height: 260 }} />
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    </div>
  );
}
