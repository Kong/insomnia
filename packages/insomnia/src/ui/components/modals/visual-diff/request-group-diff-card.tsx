import type { FC } from 'react';

import { diffByKey, diffRecord, dominantStatus, type EntityDiff, valuesEqual } from './diff-engine';
import {
  authTab,
  compactTabs,
  type DiffTabDef,
  docsTab,
  keyValueTab,
  RecordDiffRows,
  scriptsTab,
  settingsTab,
} from './diff-tabs';
import { type EntityCardActionProps, FieldDiffRow } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// `children` never shows up here: nested requests/folders are entities with their own cards.
const HANDLED_FIELD_PATHS = new Set([
  'name',
  'authentication',
  'headers',
  'scripts',
  'environment',
  'environmentPropertyOrder',
  'meta.description',
]);

function environmentTab(diff: EntityDiff): DiffTabDef | null {
  const rows = diffRecord(diff.before?.environment ?? {}, diff.after?.environment ?? {});
  // The order only tracks how variables are listed in the editor, and changes along with any
  // added/removed variable — so it's only worth showing for a pure reorder.
  const orderBefore = diff.before?.environmentPropertyOrder;
  const orderAfter = diff.after?.environmentPropertyOrder;
  const isPureReorder = rows.length === 0 && !valuesEqual(orderBefore, orderAfter);
  if (rows.length === 0 && !isPureReorder) {
    return null;
  }
  return {
    id: 'environment',
    label: 'Environment',
    status: rows.length > 0 ? dominantStatus(rows.map(row => row.status)) : 'modified',
    count: rows.length,
    content: () => (
      <div className="flex flex-col gap-3">
        <RecordDiffRows rows={rows} />
        {isPureReorder && <FieldDiffRow label="Variable Order" before={orderBefore} after={orderAfter} />}
      </div>
    ),
  };
}

// Tabs mirror the folder settings editor: Auth, Headers, Scripts, Environment, Docs, plus the
// diff-only Settings catch-all.
export function buildRequestGroupTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    authTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    scriptsTab(diff),
    environmentTab(diff),
    docsTab(diff),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

export const RequestGroupDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, { icon: 'folder', watchedPaths: [] });

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader {...header} />}
      tabs={buildRequestGroupTabs(diff)}
      {...actionProps}
    />
  );
};
