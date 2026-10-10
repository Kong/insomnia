import type { FC } from 'react';

import { diffByKey, type EntityDiff } from './diff-engine';
import { compactTabs, type DiffTabDef, keyValueTab, settingsTab } from './diff-tabs';
import type { EntityCardActionProps } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

const HANDLED_FIELD_PATHS = new Set(['name', 'cookies']);

interface Cookie {
  key?: string;
  value?: string;
  domain?: string;
  path?: string;
}

// A cookie's identity is its name + domain + path (ids aren't guaranteed stable across imports).
function withIdentity(cookies: Cookie[] | undefined) {
  return (cookies ?? []).map(cookie => ({
    ...cookie,
    identity: `${cookie.key ?? ''}\u0000${cookie.domain ?? ''}\u0000${cookie.path ?? '/'}`,
  }));
}

function cookieLabel(cookie: Cookie | undefined) {
  if (!cookie) {
    return '';
  }
  return `${cookie.key || '(unnamed)'} (${cookie.domain ?? ''}${cookie.path ?? '/'})`;
}

// Mirrors the cookie manager: one row per cookie, plus the diff-only Settings catch-all.
export function buildCookieJarTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    keyValueTab({
      id: 'cookies',
      label: 'Cookies',
      sections: [
        { rows: diffByKey(withIdentity(diff.before?.cookies), withIdentity(diff.after?.cookies), 'identity') },
      ],
      labelOf: row => cookieLabel((row.after ?? row.before) as Cookie),
    }),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

export const CookieJarDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, { icon: 'cookie-bite', watchedPaths: [] });

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader {...header} />}
      tabs={buildCookieJarTabs(diff)}
      {...actionProps}
    />
  );
};
