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

  // Keyed by outcome and error position: entity ids may be missing (section-level errors)
  // and the same entity id can appear in more than one outcome.
  const failures: { key: string; line: string }[] = [];
  const entityLines: { key: string; line: string }[] = [];

  skipped.forEach(({ workspaceName, result }, outcomeIndex) => {
    const prefix = workspaceName ? `${workspaceName}: ` : '';

    // A workspace that produced nothing still has to say so, and it is never truncated.
    if (result.yaml === '') {
      failures.push({ key: `${outcomeIndex}:export-failed`, line: `${prefix}export failed, no file was written` });
    }

    result.errors.forEach((error, errorIndex) => {
      entityLines.push({
        key: `${outcomeIndex}:${errorIndex}`,
        line: `${prefix}${error.name} (${error.entityType}) — ${error.issues[0]?.message ?? 'failed schema validation'}`,
      });
    });
  });

  const skippedCount = skipped.reduce((total, outcome) => total + outcome.result.errors.length, 0);
  // Nothing written at all is a failure, not a completion with a caveat.
  const nothingWritten = skipped.every(({ result }) => result.yaml === '');
  const hiddenCount = Math.max(0, entityLines.length - MAX_LISTED_SKIPPED_ENTITIES);

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
      title: nothingWritten ? 'Export failed, nothing was written' : `Export completed with ${skippedCount} skipped ${skippedCount === 1 ? 'entity' : 'entities'}`,
      description: (
        <div className="flex flex-col gap-1">
          {failures.map(({ key, line }) => (
            <span key={key}>{line}</span>
          ))}
          {entityLines.slice(0, MAX_LISTED_SKIPPED_ENTITIES).map(({ key, line }) => (
            <span key={key}>{line}</span>
          ))}
          {hiddenCount > 0 && <span>{`and ${hiddenCount} more`}</span>}
        </div>
      ),
    },
    { timeout: null },
  );
};
