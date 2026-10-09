import { models } from 'insomnia-data';
import type { FC } from 'react';

import { diffRecord, dominantStatus, type EntityDiff, valuesEqual } from './diff-engine';
import { compactTabs, type DiffTabDef, RecordDiffRows, settingsTab } from './diff-tabs';
import { type EntityCardActionProps, FieldDiffRow, StatusBadge } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

const { vaultEnvironmentPath, vaultEnvironmentMaskValue } = models.environment;

const HANDLED_FIELD_PATHS = new Set(['name', 'data', 'dataPropertyOrder']);

function withoutVault(data: Record<string, any> | undefined) {
  return Object.fromEntries(Object.entries(data ?? {}).filter(([key]) => key !== vaultEnvironmentPath));
}

function variablesTab(diff: EntityDiff): DiffTabDef | null {
  const rows = diffRecord(withoutVault(diff.before?.data), withoutVault(diff.after?.data));
  // Like a folder's variable order: it changes along with any added/removed variable, so it's
  // only worth showing for a pure reorder.
  const orderBefore = diff.before?.dataPropertyOrder;
  const orderAfter = diff.after?.dataPropertyOrder;
  const isPureReorder = diff.status === 'modified' && rows.length === 0 && !valuesEqual(orderBefore, orderAfter);
  if (rows.length === 0 && !isPureReorder) {
    return null;
  }
  return {
    id: 'variables',
    label: 'Variables',
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

// Vault-backed secrets are listed by name only — their values are always masked, never diffed.
function secretsTab(diff: EntityDiff): DiffTabDef | null {
  const rows = diffRecord(
    diff.before?.data?.[vaultEnvironmentPath] ?? {},
    diff.after?.data?.[vaultEnvironmentPath] ?? {},
  );
  if (rows.length === 0) {
    return null;
  }
  return {
    id: 'secrets',
    label: 'Secrets',
    status: dominantStatus(rows.map(row => row.status)),
    count: rows.length,
    content: () => (
      <ul className="flex flex-col gap-2">
        {rows.map(row => (
          <li key={row.key} className="flex items-center gap-2 rounded-xs bg-(--color-bg) p-2">
            <StatusBadge status={row.status} />
            <span className="font-mono text-sm">{row.key}</span>
            <span className="text-sm text-(--hl)">{vaultEnvironmentMaskValue}</span>
          </li>
        ))}
      </ul>
    ),
  };
}

// Tabs follow the environment editor: variables, vault secrets, plus the diff-only Settings
// catch-all (eg. color). Sub-environments are entities with their own cards.
export function buildEnvironmentTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([variablesTab(diff), secretsTab(diff), settingsTab(diff, HANDLED_FIELD_PATHS)]);
}

export const EnvironmentDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const color = (diff.after ?? diff.before)?.color;
  const header = buildHeaderLines(diff, { watchedPaths: [] });

  return (
    <TabbedDiffCard
      diff={diff}
      header={
        <>
          {color && <span className="inline-block size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
          <EntityHeader {...header} />
        </>
      }
      tabs={buildEnvironmentTabs(diff)}
      {...actionProps}
    />
  );
};
