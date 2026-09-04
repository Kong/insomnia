import type { FC } from 'react';

import type { EntityDiff } from './diff-engine';
import { CardHeaderActions, DiffCardShell, type EntityCardActionProps, entityTypeLabel, FieldDiffRow, formatValue } from './shared';

// Fallback card for entity types that don't have a dedicated visual layout yet.
// Renders a bullet list of raw field changes rather than a purpose-built layout.
export const GenericEntityDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({
  diff,
  staged,
  isPending,
  onStage,
}) => {
  return (
    <DiffCardShell status={diff.status}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-semibold">{diff.name}</span>
          <span className="text-xs text-(--hl)">{entityTypeLabel(diff.type)}</span>
        </div>
        <CardHeaderActions status={diff.status} staged={staged} isPending={isPending} onStage={onStage} />
      </div>

      {diff.status === 'added' && (
        <pre className="overflow-x-auto rounded-xs bg-(--color-success)/10 px-2 py-1 text-sm whitespace-pre-wrap text-(--color-font-success)">
          {formatValue(diff.after)}
        </pre>
      )}

      {diff.status === 'removed' && (
        <pre className="overflow-x-auto rounded-xs bg-(--color-danger)/10 px-2 py-1 text-sm whitespace-pre-wrap text-(--color-font-danger)">
          {formatValue(diff.before)}
        </pre>
      )}

      {diff.status === 'modified' && (
        <ul className="flex flex-col gap-2">
          {diff.fieldChanges.map(change => (
            <li key={change.path}>
              <FieldDiffRow label={change.label} before={change.before} after={change.after} />
            </li>
          ))}
        </ul>
      )}
    </DiffCardShell>
  );
};
