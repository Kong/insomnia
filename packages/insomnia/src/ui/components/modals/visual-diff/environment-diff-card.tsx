import { models } from 'insomnia-data';
import type { FC } from 'react';

import { diffRecord, type EntityDiff } from './diff-engine';
import { DiffCardShell, formatValue, StatusBadge, ValueChange } from './shared';

const { vaultEnvironmentPath, vaultEnvironmentMaskValue } = models.environment;

export const EnvironmentDiffCard: FC<{ diff: EntityDiff }> = ({ diff }) => {
  const environment = diff.after ?? diff.before;

  const beforeData = diff.before?.data ?? {};
  const afterData = diff.after?.data ?? {};

  const variableRows = diffRecord(
    Object.fromEntries(Object.entries(beforeData).filter(([key]) => key !== vaultEnvironmentPath)),
    Object.fromEntries(Object.entries(afterData).filter(([key]) => key !== vaultEnvironmentPath)),
  );

  const secretRows = diffRecord(beforeData[vaultEnvironmentPath] ?? {}, afterData[vaultEnvironmentPath] ?? {});

  const nameChanged = diff.fieldChanges.find(c => c.path === 'name');
  const colorChanged = diff.fieldChanges.find(c => c.path === 'color');

  return (
    <DiffCardShell status={diff.status}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {environment?.color && (
            <span
              className="inline-block size-3 shrink-0 rounded-full"
              style={{ backgroundColor: environment.color }}
            />
          )}
          <span className="font-semibold">{diff.name}</span>
        </div>
        <StatusBadge status={diff.status} />
      </div>

      {diff.status !== 'modified' && Object.keys(afterData || beforeData).length > 0 && (
        <span className="text-sm text-(--hl)">
          {Object.keys((diff.status === 'removed' ? beforeData : afterData)).filter(key => key !== vaultEnvironmentPath).length} variable(s)
        </span>
      )}

      {diff.status === 'modified' && (
        <>
          {nameChanged && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-(--hl)">Name</span>
              <ValueChange before={nameChanged.before} after={nameChanged.after} />
            </div>
          )}
          {colorChanged && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-(--hl)">Color</span>
              <ValueChange before={colorChanged.before} after={colorChanged.after} />
            </div>
          )}

          {variableRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Variables</span>
              <ul className="flex flex-col gap-2">
                {variableRows.map(row => (
                  <li key={row.key} className="flex flex-col gap-1 rounded-xs bg-(--color-bg) p-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={row.status} />
                      <span className="font-mono text-sm">{row.key}</span>
                    </div>
                    {row.status === 'modified' && <ValueChange before={row.before} after={row.after} />}
                    {row.status === 'added' && (
                      <pre className="overflow-x-auto rounded-xs bg-(--color-success)/10 px-2 py-1 text-sm whitespace-pre-wrap text-(--color-font-success)">
                        {formatValue(row.after)}
                      </pre>
                    )}
                    {row.status === 'removed' && (
                      <pre className="overflow-x-auto rounded-xs bg-(--color-danger)/10 px-2 py-1 text-sm whitespace-pre-wrap text-(--color-font-danger)">
                        {formatValue(row.before)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {secretRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Secrets</span>
              <ul className="flex flex-col gap-2">
                {secretRows.map(row => (
                  <li key={row.key} className="flex items-center gap-2 rounded-xs bg-(--color-bg) p-2">
                    <StatusBadge status={row.status} />
                    <span className="font-mono text-sm">{row.key}</span>
                    <span className="text-sm text-(--hl)">{vaultEnvironmentMaskValue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </DiffCardShell>
  );
};
