import type { FC } from 'react';

import { getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff } from './diff-engine';
import { authTab, compactTabs, type DiffTabDef, docsTab, keyValueTab, settingsTab } from './diff-tabs';
import type { EntityCardActionProps } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

const HANDLED_FIELD_PATHS = new Set([
  'name',
  'url',
  'headers',
  'parameters',
  'pathParameters',
  'authentication',
  'meta.description',
]);

// Tabs mirror the WebSocket request editor: Params, Auth, Headers, Docs (its message body isn't
// persisted to the git file), plus the diff-only Settings catch-all.
export function buildWebSocketTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    keyValueTab({
      id: 'params',
      label: 'Params',
      sections: [
        { title: 'Query Parameters', rows: diffByKey(diff.before?.parameters, diff.after?.parameters, 'name') },
        { title: 'Path Parameters', rows: diffByKey(diff.before?.pathParameters, diff.after?.pathParameters, 'name') },
      ],
    }),
    authTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    docsTab(diff),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

const WS_BADGE = { label: 'WS', className: getRequestBadgeClassName('WS') };

export const WebSocketDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, {
    badgeOf: () => WS_BADGE,
    detailOf: node => node?.url || '(no url)',
    watchedPaths: ['url'],
  });

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader {...header} />}
      tabs={buildWebSocketTabs(diff)}
      {...actionProps}
    />
  );
};
