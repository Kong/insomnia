import type { FC } from 'react';

import { getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff } from './diff-engine';
import { authTab, compactTabs, type DiffTabDef, docsTab, keyValueTab, settingsTab } from './diff-tabs';
import type { EntityCardActionProps } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

const HANDLED_FIELD_PATHS = new Set([
  'name',
  'url',
  'transportType',
  'headers',
  'authentication',
  'env',
  'roots',
  'meta.description',
]);

// Tabs mirror the MCP request editor: Auth, Headers, Env (stdio server variables) and Roots (its
// Params tab is runtime-only), plus Docs and the diff-only Settings catch-all.
export function buildMcpTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    authTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    // Variables are matched by id (renaming one keeps its identity) but shown by name.
    keyValueTab({
      id: 'env',
      label: 'Env',
      sections: [{ rows: diffByKey(diff.before?.env, diff.after?.env, 'id') }],
      labelOf: row => ((row.after ?? row.before) as { name?: string })?.name || '(unnamed variable)',
    }),
    keyValueTab({
      id: 'roots',
      label: 'Roots',
      sections: [{ rows: diffByKey(diff.before?.roots, diff.after?.roots, 'uri') }],
      labelOf: row => ((row.after ?? row.before) as { name?: string })?.name || row.key,
      getRowValue: item => item?.uri,
    }),
    docsTab(diff),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

const MCP_BADGE = { label: 'MCP', className: getRequestBadgeClassName('MCP') };

// Same wording as the MCP URL bar's transport picker; for stdio the "url" is the server command.
function connectionOf(node: any) {
  if (!node) {
    return '';
  }
  return `${node.transportType === 'stdio' ? 'STDIO' : 'HTTP'} ${node.url || '(no url)'}`;
}

export const McpDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, {
    badgeOf: () => MCP_BADGE,
    detailOf: connectionOf,
    watchedPaths: ['url', 'transportType'],
  });

  return (
    <TabbedDiffCard diff={diff} header={<EntityHeader {...header} />} tabs={buildMcpTabs(diff)} {...actionProps} />
  );
};
