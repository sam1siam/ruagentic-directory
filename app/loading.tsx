export default function Loading() {
  return (
    <main className="content-page" aria-busy="true">
      <output className="loading-state">
        <i className="live-dot" aria-hidden="true" />
        Loading RUAGENTIC…
      </output>
    </main>
  );
}
