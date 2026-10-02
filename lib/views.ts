/** Pure view-count maths shared by the dashboard and its tests. */
export type ViewRow = { slug: string; day: string; views: number };
export type ViewTotals = { week: number; month: number; total: number };
const DAY = 86_400_000;
/** Sums per slug for the last 7 days, the last 30 days and all time. `today`
 *  is a UTC date string; a day counts as "within N days" when it is at most
 *  N-1 days before today, so a 7-day window is today plus six earlier days. */
export function aggregateViews(
  rows: ViewRow[],
  today = new Date().toISOString().slice(0, 10),
): Map<string, ViewTotals> {
  const end = Date.parse(today + 'T00:00:00Z');
  const totals = new Map<string, ViewTotals>();
  for (const row of rows) {
    const t = totals.get(row.slug) ?? { week: 0, month: 0, total: 0 };
    const age = (end - Date.parse(row.day + 'T00:00:00Z')) / DAY;
    t.total += row.views;
    if (age < 30) t.month += row.views;
    if (age < 7) t.week += row.views;
    totals.set(row.slug, t);
  }
  return totals;
}
/** Crawlers and automation never count as a view. */
export const isBot = (userAgent: string | null) =>
  !userAgent ||
  /bot|crawl|spider|slurp|headless|lighthouse|preview|fetch|monitor|scan|curl|wget|python|axios|node-fetch|go-http/i.test(
    userAgent,
  );
export const validSlug = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
