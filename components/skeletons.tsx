/** Ghost placeholders that match the real components' geometry so nothing
 *  shifts when content arrives. Purely presentational. */
export function ToolCardSkeleton() {
  return (
    <div className="ghost-card" aria-hidden="true">
      <div className="ghost-row">
        <span className="ghost ghost-monogram" />
        <span className="ghost ghost-badge" />
      </div>
      <span className="ghost ghost-title" />
      <span className="ghost ghost-line" />
      <span className="ghost ghost-line short" />
      <div className="ghost-footer">
        <span className="ghost ghost-meta" />
        <span className="ghost ghost-meta" />
        <span className="ghost ghost-meta short" />
      </div>
    </div>
  );
}
export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="listing-grid">
      {Array.from({ length: count }, (_, i) => (
        <ToolCardSkeleton key={i} />
      ))}
    </div>
  );
}
function FilterPanelSkeleton() {
  return (
    <aside className="filter-panel ghost-panel" aria-hidden="true">
      {[1, 4, 10, 3].map((rows, block) => (
        <div className="filter-block" key={block}>
          <span className="ghost ghost-label" />
          {block === 0 ? (
            <span className="ghost ghost-input" />
          ) : (
            Array.from({ length: rows }, (_, i) => (
              <span className="ghost ghost-option" key={i} />
            ))
          )}
        </div>
      ))}
    </aside>
  );
}
function SectionHeadSkeleton() {
  return (
    <header className="section-head ghost-head" aria-hidden="true">
      <span className="ghost ghost-heading" />
      <span className="ghost ghost-line" />
    </header>
  );
}
/** Home page: hero, sidebar and the first featured sections. */
export function HomeSkeleton() {
  return (
    <main className="browse-page" aria-busy="true">
      <span className="sr-only">Loading the directory…</span>
      <section className="catalog-hero" aria-hidden="true">
        <div className="hero-copy">
          <span className="ghost ghost-hero-line" />
          <span className="ghost ghost-hero-line short" />
          <span className="ghost ghost-lead" />
          <span className="ghost ghost-search" />
        </div>
        <div className="publication-panel ghost-checker">
          {Array.from({ length: 5 }, (_, i) => (
            <span className="ghost ghost-option" key={i} />
          ))}
        </div>
      </section>
      <div className="browse-layout">
        <FilterPanelSkeleton />
        <div className="browse-main">
          {[0, 1].map((section) => (
            <section className="browse-section" key={section}>
              <SectionHeadSkeleton />
              <ListingGridSkeleton count={6} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
/** Kind and category pages: heading, sidebar and a grid. */
export function BrowseSkeleton({ count = 9 }: { count?: number }) {
  return (
    <main className="browse-page" aria-busy="true">
      <span className="sr-only">Loading listings…</span>
      <div className="browse-heading" aria-hidden="true">
        <span className="ghost ghost-heading large" />
        <span className="ghost ghost-lead" />
      </div>
      <div className="browse-layout">
        <FilterPanelSkeleton />
        <div className="browse-main">
          <section className="browse-section">
            <SectionHeadSkeleton />
            <ListingGridSkeleton count={count} />
          </section>
        </div>
      </div>
    </main>
  );
}
/** Categories index. */
export function CategoryCardsSkeleton({ count = 9 }: { count?: number }) {
  return (
    <main className="content-page" aria-busy="true">
      <span className="sr-only">Loading categories…</span>
      <div className="collections-heading" aria-hidden="true">
        <div>
          <span className="ghost ghost-heading large" />
          <span className="ghost ghost-lead" />
        </div>
      </div>
      <div className="collection-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div className="collection-card ghost-collection" key={i}>
            <span
              className="ghost ghost-meta short"
              style={{ alignSelf: 'flex-end' }}
            />
            <span className="ghost ghost-title wide" />
            <span className="ghost ghost-line" />
            <span className="ghost ghost-line short" />
            <div className="ghost-footer">
              <span className="ghost ghost-chip" />
              <span className="ghost ghost-chip" />
              <span className="ghost ghost-chip" />
              <span
                className="ghost ghost-meta short"
                style={{ marginLeft: 'auto' }}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
