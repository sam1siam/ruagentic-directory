'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ motion */
/** Magnetic primary buttons and cursor-following card glow from the handoff.
 *  Mouse only; disabled under prefers-reduced-motion. */
export function DesignInteractions() {
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    let active: HTMLElement | null = null;
    let frame = 0;
    const reset = () => {
      active?.style.removeProperty('translate');
      active = null;
    };
    const move = (event: PointerEvent) => {
      if (reduced.matches || !fine.matches || event.pointerType !== 'mouse')
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = event.target instanceof Element ? event.target : null;
        const card = target?.closest<HTMLElement>(
          '[data-cursor-glow], .collection-card',
        );
        if (card) {
          const rect = card.getBoundingClientRect();
          card.style.setProperty(
            '--cursor-x',
            `${event.clientX - rect.left}px`,
          );
          card.style.setProperty('--cursor-y', `${event.clientY - rect.top}px`);
        }
        const button = target?.closest<HTMLElement>(
          '.button.primary, [data-slot="button"][data-variant="default"]',
        );
        if (active !== button) reset();
        if (!button || button.matches(':disabled, [aria-disabled="true"]'))
          return;
        active = button;
        const rect = button.getBoundingClientRect();
        const translated = getComputedStyle(button)
          .translate.split(' ')
          .map(parseFloat);
        const x =
          event.clientX - rect.left + (translated[0] || 0) - rect.width / 2;
        const y =
          event.clientY - rect.top + (translated[1] || 0) - rect.height / 2;
        button.style.translate = `${x * 0.25}px ${y * 0.35}px`;
      });
    };
    const leave = (event: PointerEvent) => {
      if (
        active &&
        (!(event.relatedTarget instanceof Node) ||
          !active.contains(event.relatedTarget))
      ) {
        cancelAnimationFrame(frame);
        reset();
      }
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      reset();
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerout', leave, { passive: true });
    window.addEventListener('blur', stop);
    reduced.addEventListener('change', stop);
    fine.addEventListener('change', stop);
    return () => {
      stop();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerout', leave);
      window.removeEventListener('blur', stop);
      reduced.removeEventListener('change', stop);
      fine.removeEventListener('change', stop);
    };
  }, []);
  return null;
}

/* ------------------------------------------------------------------ light field */
const lightPages = new Set([
  'home',
  'collections',
  'pricing',
  'login',
  'reset-password',
  'submit',
  'footer',
]);
export function LightField({ variant }: { variant?: string }) {
  const path = usePathname();
  const page = variant ?? (path === '/' ? 'home' : path.split('/')[1]);
  return (
    <div
      className={`light-field light-${lightPages.has(page) ? page : 'page'}`}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </div>
  );
}

/* ------------------------------------------------------------------ brackets */
export function CornerBrackets({
  amber,
  small,
  diagonal,
}: {
  amber?: boolean;
  small?: boolean;
  diagonal?: boolean;
}) {
  return (
    <span
      className={
        'corner-brackets' +
        (amber ? ' amber' : '') +
        (small ? ' small' : '') +
        (diagonal ? ' diagonal' : '')
      }
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

/* ------------------------------------------------------------------ headline */
const HEADLINE = 'Mission control for the agentic stack.';
const GLYPHS = '!<>-_\\/[]{}=+*^?#%&';
export function DecodeHeadline() {
  const [buffer, setBuffer] = useState(HEADLINE);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  function play() {
    if (interval.current) clearInterval(interval.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBuffer(HEADLINE);
      return;
    }
    let frame = 0;
    const total = HEADLINE.length + 14;
    interval.current = setInterval(() => {
      frame++;
      setBuffer(
        HEADLINE.split('')
          .map((char, index) =>
            char === ' ' || frame - 6 > index * 0.9
              ? char
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(''),
      );
      if (frame > total) {
        clearInterval(interval.current!);
        interval.current = null;
        setBuffer(HEADLINE);
      }
    }, 38);
  }
  useEffect(() => {
    const timer = setTimeout(play, 300);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (interval.current) clearInterval(interval.current);
      setBuffer(HEADLINE);
    };
    reduced.addEventListener('change', stop);
    return () => {
      clearTimeout(timer);
      if (interval.current) clearInterval(interval.current);
      reduced.removeEventListener('change', stop);
    };
  }, []);
  return (
    <div className="decode-wrap">
      <h1 className="decode-headline" data-text={HEADLINE}>
        <span className="sr-only">{HEADLINE}</span>
        <span className="decode-buffer" aria-hidden="true">
          {buffer}
        </span>
      </h1>
      <button
        className="decode-replay"
        type="button"
        onClick={play}
        aria-label="Replay headline animation"
        title="Replay headline animation"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ shortcut label */
const noSubscribe = () => () => {};
/** ⌘K on Apple platforms, Ctrl K elsewhere; the server renders the design's ⌘K. */
export function useShortcutLabel() {
  const mac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform ?? ''),
    () => true,
  );
  return mac ? '⌘K' : 'Ctrl K';
}

/* ------------------------------------------------------------------ clock */
export function UtcClock() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    const timer = setInterval(tick, 1000);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(timer);
      clearTimeout(first);
    };
  }, []);
  return (
    <time className="utc-clock" aria-label={`UTC time ${time}`}>
      UTC {time}
    </time>
  );
}

/* ------------------------------------------------------------------ checker demo */
/** The five file checks the directory actually runs, shown as a sample run:
 *  one 900ms tick per check, three ticks of rest, then the loop restarts. */
export const checkerLabels = [
  'JSON file',
  'Profile structure',
  'Service origin',
  'Text index',
  'README.md',
] as const;
/** Subscribe to a media query without setting state inside an effect. */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (notify) => {
      const list = matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => matchMedia(query).matches,
    () => serverValue,
  );
}
export function CheckerDemo() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setTick((s) => (s + 1) % 8), 900);
    return () => clearInterval(timer);
  }, [reduced]);
  const step = reduced ? 5 : tick;
  const done = step >= 5;
  const filled = Math.min(step, 5) * 4;
  return (
    <aside
      className="publication-panel glass amber"
      aria-label="Publication checker sample run"
    >
      <CornerBrackets amber />
      <div className="checker-head">
        <h2>Publication checker</h2>
        <span>sample run</span>
      </div>
      <ul className="checker-rows">
        {checkerLabels.map((label, index) => {
          const state =
            index < step ? 'pass' : index === step && !done ? 'run' : 'wait';
          return (
            <li className="checker-row" data-state={state} key={label}>
              <i />
              <span>{label}</span>
              <b>{state.toUpperCase()}</b>
            </li>
          );
        })}
      </ul>
      <div className="checker-bar" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => (
          <i key={i} data-on={i < filled ? (done ? 'pass' : 'run') : ''} />
        ))}
      </div>
      <div className="checker-status" aria-live="off">
        <span>STATUS</span>
        <b data-done={done}>
          {done ? 'PASS · ready to publish' : `checking ${step + 1}/5`}
        </b>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ submit flow bus */
/** The submit form reports its current phase and save state so the header
 *  can show the breadcrumb and draft status without sharing React state. */
export type SubmitState = {
  step: string;
  saved: 'new' | 'saved' | 'dirty';
  at: string;
};
let current: SubmitState = { step: 'PROJECT', saved: 'new', at: '' };
const listeners = new Set<() => void>();
export function emitSubmitState(state: SubmitState) {
  current = state;
  for (const fn of listeners) fn();
}
export function useSubmitState() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
}
