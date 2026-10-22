import type { FC } from 'react';

import { type EntityDiff, ownFields } from './diff-engine';
import { compactTabs, type DiffTabDef, fieldChangesTab } from './diff-tabs';
import { type EntityCardActionProps, entityTypeLabel } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

function withoutName(node: any) {
  if (!node || typeof node !== 'object') {
    return node;
  }
  return Object.fromEntries(Object.entries(ownFields(node)).filter(([key]) => key !== 'name'));
}

// No editor to mirror, so every field goes into one tab: the changed ones for a modified entity,
// all of them for an added/removed one. The name is left to the header.
export function buildGenericTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    fieldChangesTab({
      id: 'fields',
      label: 'Fields',
      before: withoutName(diff.before),
      after: withoutName(diff.after),
    }),
  ]);
}

// Fallback card for entity types without a purpose-built layout (eg. file-level sections).
export const GenericEntityDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, { watchedPaths: [] });
  const typeBadge = { label: entityTypeLabel(diff.type), className: 'bg-(--hl-sm) text-(--hl)' };

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader current={{ ...header.current, badge: typeBadge }} previous={header.previous} />}
      tabs={buildGenericTabs(diff)}
      {...actionProps}
    />
  );
};
