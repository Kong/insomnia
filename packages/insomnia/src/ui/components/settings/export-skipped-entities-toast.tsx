import React from 'react';

import type { InsomniaV5ExportResult } from '~/common/insomnia-v5';
import { showToast } from '~/ui/components/toast-notification';

/** What one workspace produced during an export action, and what had to be skipped. */
export interface ExportOutcome {
  /** Omitted when the export covers a single workspace and the toast needs no label. */
  workspaceName?: string;
  result: InsomniaV5ExportResult;
}

const MAX_LISTED_SKIPPED_ENTITIES = 5;

/**
 * Reports the entities an export action had to skip, one toast for the action. It does not
 * auto-dismiss: the skipped entities are only surfaced here, and the file on disk stays
 * incomplete until the user acts on them.
 */
export const showExportSkippedEntitiesToast = (outcomes: ExportOutcome[]) => {
  const skipped = outcomes.filter(outcome => outcome.result.errors.length > 0);

  if (skipped.length === 0) {
    return;
  }

  // Keyed by the failing entity id: identical display lines from different entities stay unique.
  const lines = skipped.flatMap(({ workspaceName, result }) => {
    const prefix = workspaceName ? `${workspaceName}: ` : '';

    const entityLines = result.errors.map(error => ({
      key: `${error.entityId}:${error.issues[0]?.path ?? ''}`,
      line: `${prefix}${error.name} (${error.entityType}) — ${error.issues[0]?.message ?? 'failed schema validation'}`,
    }));

    // A workspace that produced nothing still has to say which entities are to blame.
    return result.yaml === ''
      ? [{ key: `${result.errors[0]?.entityId}:export-failed`, line: `${prefix}export failed, no file was written` }, ...entityLines]
      : entityLines;
  });

  const skippedCount = skipped.reduce((total, outcome) => total + outcome.result.errors.length, 0);

  // The YAML itself is left out — it can be megabytes and the toast already carries the user-facing report.
  console.error(
    '[export] entities skipped during export',
    skipped.map(({ workspaceName, result }) => ({
      workspaceName,
      yamlWritten: result.yaml !== '',
      entities: result.errors.map(error =>
        `${error.entityType} "${error.name}" at ${error.path || '(root)'}: ${error.issues
          .map(issue => issue.message)
          .join('; ')}`,
      ),
    })),
  );

  showToast(
    {
      icon: 'circle-exclamation',
      status: 'error',
      title: `Export completed with ${skippedCount} skipped ${skippedCount === 1 ? 'entity' : 'entities'}`,
      description: (
        <div className="flex flex-col gap-1">
          {lines.slice(0, MAX_LISTED_SKIPPED_ENTITIES).map(({ key, line }) => (
            <span key={key}>{line}</span>
          ))}
          {lines.length > MAX_LISTED_SKIPPED_ENTITIES && (
            <span>{`and ${lines.length - MAX_LISTED_SKIPPED_ENTITIES} more`}</span>
          )}
        </div>
      ),
    },
    { timeout: null },
  );
};
