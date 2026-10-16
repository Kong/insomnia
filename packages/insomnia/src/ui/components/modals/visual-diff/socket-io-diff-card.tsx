import type { FC } from 'react';

import { getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff } from './diff-engine';
import { authTab, type DiffTabDef, docsTab, keyValueTab, withSettingsTab } from './diff-tabs';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// Fields shown in the card's header; every other changed field is shown by a tab or the Settings catch-all.
const HEADER_FIELD_PATHS = new Set(['name', 'url']);

// Tabs mirror the Socket.IO request editor: Params, Events, Auth, Headers, Docs (its message body
// isn't persisted to the git file), plus the diff-only Settings catch-all.
export function buildSocketIOTabs(diff: EntityDiff): DiffTabDef[] {
  return withSettingsTab(diff, HEADER_FIELD_PATHS, [
    keyValueTab({
      id: 'params',
      label: 'Params',
      sections: [
        {
          title: 'Query Parameters',
          path: 'parameters',
          rows: diffByKey(diff.before?.parameters, diff.after?.parameters, 'name'),
        },
        {
          title: 'Path Parameters',
          path: 'pathParameters',
          rows: diffByKey(diff.before?.pathParameters, diff.after?.pathParameters, 'name'),
        },
      ],
    }),
    // Listeners are matched by id (renaming one keeps its identity) but shown by event name.
    keyValueTab({
      id: 'events',
      label: 'Events',
      sections: [
        { path: 'eventListeners', rows: diffByKey(diff.before?.eventListeners, diff.after?.eventListeners, 'id') },
      ],
      labelOf: row => ((row.after ?? row.before) as { eventName?: string })?.eventName || '(unnamed event)',
      getRowValue: item => item?.desc,
    }),
    authTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ path: 'headers', rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    docsTab(diff),
  ]);
}

const IO_BADGE = { label: 'IO', className: getRequestBadgeClassName('IO') };

export const SocketIODiffCard: FC<{ diff: EntityDiff }> = ({ diff }) => {
  const header = buildHeaderLines(diff, {
    badgeOf: () => IO_BADGE,
    detailOf: node => node?.url || '(no url)',
    watchedPaths: ['url'],
  });

  return <TabbedDiffCard diff={diff} header={<EntityHeader {...header} />} tabs={buildSocketIOTabs(diff)} />;
};
