import Link from 'next/link';
import styles from './tool-card.module.css';

type ToolCardProps = {
  name: string;
  kind: string;
  summary: string;
  category: string;
  source?: string;
  href?: string;
};

/** Shared by discovery and the submission preview; styles are isolated from legacy cards. */
export default function ToolCard({
  name,
  kind,
  summary,
  category,
  source,
  href,
}: ToolCardProps) {
  const sourceLabel =
    source === 'Official MCP Registry'
      ? 'MCP REGISTRY'
      : source === 'Publisher documentation'
        ? 'PUBLISHER'
        : source;
  const content = (
    <>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.header}>
        <span className={styles.monogram} aria-hidden="true">
          {name.slice(0, 2).toUpperCase()}
        </span>
        <span className={styles.kind}>
          {kind === 'server'
            ? 'MCP SERVER'
            : kind === 'client'
              ? 'MCP CLIENT'
              : 'AGENTIC PRODUCT'}
        </span>
      </div>
      <h3 className={styles.title}>{name}</h3>
      <p className={styles.description}>{summary}</p>
      <div className={styles.footer}>
        <span title={source}>{sourceLabel || 'YOUR PROJECT'}</span>
        <span title={category}>{category}</span>
        <span className={styles.action}>{href ? 'VIEW' : 'PREVIEW'}</span>
      </div>
    </>
  );
  return href ? (
    <Link
      href={href}
      className={styles.card}
      data-cursor-glow=""
      aria-label={name}
    >
      {content}
    </Link>
  ) : (
    <article className={styles.card}>{content}</article>
  );
}
