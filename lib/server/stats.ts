import { cache } from 'react';
import { catalog } from './catalog';
export type DirectoryStats = {
  total: number;
  servers: number;
  clients: number;
  products: number;
  /** ISO date (YYYY-MM-DD) of the newest listing observation or publication. */
  lastIndexed: string;
  /** Whole days since that observation, or null when the catalog is empty. */
  updatedDays: number | null;
};
/** Real directory counts for the telemetry strip, footer and stat tiles. */
export const directoryStats = cache(async (): Promise<DirectoryStats> => {
  const items = await catalog();
  const count = (kind: string) => items.filter((i) => i.kind === kind).length;
  const latest = items
    .map((i) => i.publishedAt || i.observedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    total: items.length,
    servers: count('server'),
    clients: count('client'),
    products: count('product'),
    lastIndexed: latest ? latest.slice(0, 10) : '',
    updatedDays: latest
      ? Math.max(0, Math.round((Date.now() - Date.parse(latest)) / 86400000))
      : null,
  };
});
