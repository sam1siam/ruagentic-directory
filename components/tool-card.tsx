import Link from 'next/link';
import { kindByValue } from '@/lib/categories';
import { compact } from '@/lib/leaderboard';
import styles from './tool-card.module.css';

type ToolCardProps = {
  name: string;
  kind: string;
  summary: string;
  category: string;
  source?: string;
  href?: string;
  /** Public GitHub stars from the metrics cron; omitted when unknown. */
  stars?: number | null;
};

/** Shared by discovery and the submission preview; styles are isolated from legacy cards. */
export default function ToolCard({
  name,
  kind,
  summary,
  category,
  source,
  href,
  stars,
}: ToolCardProps) {
  const sourceLabel =
    source === 'Official MCP Registry'
      ? 'MCP REGISTRY'
      : source === 'Publisher documentation' ||
          source === 'Publisher repository' ||
          source === 'Publisher endpoint'
        ? 'PUBLISHER'
        : source === 'User submission'
          ? 'SUBMITTED'
          : source;
  const content = (
    <>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.header}>
        <span className={styles.monogram} aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className={styles.kind}>
          {kindByValue(kind)?.singular.toUpperCase() ?? 'LISTING'}
        </span>
      </div>
      <h3 className={styles.title}>{name}</h3>
      <p className={styles.description}>{summary}</p>
      <div className={styles.footer}>
        <span title={source}>{sourceLabel || 'YOUR PROJECT'}</span>
        <span title={category}>{category}</span>
        {typeof stars === 'number' && (
          <span
            className={styles.stars}
            title={stars.toLocaleString('en-US') + ' GitHub stars'}
          >
            ★ {compact(stars)}
          </span>
        )}
        <span className={styles.action}>{href ? 'VIEW' : 'PREVIEW'}</span>
      </div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className={styles.card}
      data-kind={kind}
      data-cursor-glow=""
      aria-label={name}
    >
      {content}
    </Link>
  ) : (
    <article className={styles.card} data-kind={kind}>
      {content}
    </article>
  );
}
