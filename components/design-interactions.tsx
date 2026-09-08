'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Motion from the supplied handoff. No simulated traffic or checker results. */
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
          '.listing-card, .collection-card',
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
          '.button.primary, [data-slot="button"].bg-primary',
        );
        if (active !== button) reset();
        if (!button || button.matches(':disabled, [aria-disabled="true"]'))
          return;
        active = button;
        // Offset dimensions do not change as the magnetic translate moves the button.
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

export function LightField({ variant }: { variant?: string }) {
  const path = usePathname();
  const page = variant ?? (path === '/' ? 'home' : path.split('/')[1]);
  return (
    <div className={`light-field light-${page}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  );
}

export function CornerBrackets() {
  return (
    <span className="corner-brackets" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export function DecodeHeadline() {
  const text = 'Mission control for the agentic stack.';
  const [buffer, setBuffer] = useState(text);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  function play() {
    if (interval.current) clearInterval(interval.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBuffer(text);
      return;
    }
    let frame = 0;
    const glyphs = '!<>-_\\/[]{}=+*^?#%&';
    interval.current = setInterval(() => {
      frame++;
      setBuffer(
        text
          .split('')
          .map((char, index) =>
            char === ' ' || frame - 6 > index * 0.9
              ? char
              : glyphs[Math.floor(Math.random() * glyphs.length)],
          )
          .join(''),
      );
      if (frame >= text.length + 14) {
        clearInterval(interval.current!);
        interval.current = null;
        setBuffer(text);
      }
    }, 38);
  }
  useEffect(() => {
    const timer = setTimeout(play, 300);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {
      if (interval.current) clearInterval(interval.current);
      setBuffer(text);
    };
    reduced.addEventListener('change', stop);
    return () => {
      clearTimeout(timer);
      if (interval.current) clearInterval(interval.current);
      reduced.removeEventListener('change', stop);
    };
  }, []);
  const split = text.indexOf('agentic');
  return (
    <h1 className="decode-headline">
      <button
        className="decode-button"
        type="button"
        onClick={play}
        aria-label={text}
        title="Replay headline animation"
      >
        <span className="decode-measure" aria-hidden="true">
          Mission control for the <em>agentic stack.</em>
        </span>
        <span className="decode-buffer" aria-hidden="true">
          {buffer.slice(0, split)}
          <em>{buffer.slice(split)}</em>
        </span>
      </button>
    </h1>
  );
}

export function UtcClock() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().slice(11, 19));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="utc-clock" aria-label={`UTC time ${time}`}>
      {time} UTC
    </time>
  );
}
