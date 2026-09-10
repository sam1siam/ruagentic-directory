'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { DirectoryStats } from '@/lib/server/stats';

const noop = () => () => {};

function useUtc() {
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
  return time;
}

/** Left rail: a truthful session log for the sign-in screen. */
export function SessionLog({ ready }: { ready: boolean }) {
  const time = useUtc();
  const secure = useSyncExternalStore(
    noop,
    () => location.protocol === 'https:',
    () => true,
  );
  return (
    <aside className="auth-rail" aria-hidden="true">
      <div className="rail-title">{'// SESSION LOG'}</div>
      <div>
        {time} auth.gateway{' '}
        {ready ? <span className="ok">ready</span> : 'configuring'}
      </div>
      <div>{time} providers github · magic-link · password</div>
      <div>
        {time} transport{' '}
        {secure ? (
          <>
            https · <span className="ok">secure</span>
          </>
        ) : (
          'http · local'
        )}
      </div>
      <div>
        {time} awaiting operator<span className="cursor">▌</span>
      </div>
    </aside>
  );
}

/** Right rail: real directory counts. */
export function NetworkRail({ stats }: { stats: DirectoryStats }) {
  return (
    <aside className="auth-rail right" aria-hidden="true">
      <div className="rail-title">{'// NETWORK'}</div>
      <div>{stats.total.toLocaleString()} listings indexed</div>
      <div>
        {stats.servers} servers · {stats.clients} clients · {stats.products} AI
        agents
      </div>
    </aside>
  );
}
