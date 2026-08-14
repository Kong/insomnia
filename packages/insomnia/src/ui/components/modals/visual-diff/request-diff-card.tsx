import type { FC } from 'react';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import { computeFieldChanges, diffByKey, type EntityDiff, type KeyedDiffRow } from './diff-engine';
import { CardHeaderActions, DiffCardShell, type EntityCardActionProps, FieldDiffRow, StatusBadge } from './shared';

const HANDLED_FIELD_PATHS = new Set([
  'name',
  'url',
  'method',
  'headers',
  'parameters',
  'pathParameters',
  'body',
  'authentication',
  'meta.description',
]);

// Renders a name/value key-value row the same way the app's own header/param
// editors do, instead of dumping the raw {name, value, disabled} object as JSON.
const KeyValueDiffRows: FC<{ title: string; rows: KeyedDiffRow[] }> = ({ title, rows }) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{title}</span>
      <ul className="flex flex-col gap-2">
        {rows.map(row => {
          const item = (row.after ?? row.before) as { value?: string; fileName?: string; disabled?: boolean } | undefined;

          if (row.status === 'modified') {
            const fieldChanges = computeFieldChanges(row.before, row.after);
            return (
              <li key={row.key} className="flex flex-col gap-2 rounded-xs bg-(--color-bg) p-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  <span className="font-mono text-sm font-medium">{row.key}</span>
                </div>
                <div className="flex flex-col gap-2 pl-1">
                  {fieldChanges.map(change => (
                    <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
                  ))}
                </div>
              </li>
            );
          }

          const isAdded = row.status === 'added';
          return (
            <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xs bg-(--color-bg) p-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={row.status} />
                <span className="font-mono text-sm font-medium">{row.key}</span>
                {item?.disabled && <span className="text-xs text-(--hl)">(disabled)</span>}
              </div>
              <span
                className={`truncate font-mono text-sm ${isAdded ? 'text-(--color-font-success)' : 'text-(--color-font-danger) line-through'}`}
              >
                {item?.value ?? item?.fileName ?? '(empty)'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const RequestDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, staged, isPending, onStage }) => {
  const request = diff.after ?? diff.before;
  const method = request?.method || 'GET';

  const headerRows = diffByKey(diff.before?.headers, diff.after?.headers, 'name');
  const parameterRows = diffByKey(diff.before?.parameters, diff.after?.parameters, 'name');
  const pathParameterRows = diffByKey(diff.before?.pathParameters, diff.after?.pathParameters, 'name');
  const bodyParamRows = diffByKey(diff.before?.body?.params, diff.after?.body?.params, 'name');

  const nameChanged = diff.fieldChanges.find(c => c.path === 'name');
  const urlChanged = diff.fieldChanges.find(c => c.path === 'url');
  const methodChanged = diff.fieldChanges.find(c => c.path === 'method');
  const bodyChanged = diff.fieldChanges.find(c => c.path === 'body');
  const authChanged = diff.fieldChanges.find(c => c.path === 'authentication');
  const descriptionChanged = diff.fieldChanges.find(c => c.path === 'meta.description');

  const otherChanges = diff.fieldChanges.filter(c => !HANDLED_FIELD_PATHS.has(c.path));

  const bodyMimeTypeChanged =
    diff.status === 'modified' && diff.before?.body?.mimeType !== diff.after?.body?.mimeType;
  const bodyTextChanged = diff.status === 'modified' && diff.before?.body?.text !== diff.after?.body?.text;

  const authFieldChanges = authChanged ? computeFieldChanges(diff.before?.authentication, diff.after?.authentication) : [];

  return (
    <DiffCardShell status={diff.status}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className={`shrink-0 rounded-xs px-1.5 py-0.5 text-xs font-bold ${getRequestBadgeClassName(formatMethodName(method))}`}>
            {formatMethodName(method)}
          </span>
          <span className="truncate font-mono text-sm text-(--hl)">{request?.url || '(no url)'}</span>
        </div>
        <CardHeaderActions status={diff.status} staged={staged} isPending={isPending} onStage={onStage} />
      </div>

      <span className="font-semibold">{diff.name}</span>

      {diff.status !== 'modified' && (
        <div className="flex flex-col gap-1 text-sm text-(--hl)">
          {(request?.headers?.length ?? 0) > 0 && <span>{request.headers.length} header(s)</span>}
          {(request?.parameters?.length ?? 0) > 0 && <span>{request.parameters.length} query parameter(s)</span>}
          {request?.authentication?.type && request.authentication.type !== 'none' && (
            <span>Authentication: {request.authentication.type}</span>
          )}
        </div>
      )}

      {diff.status === 'modified' && (
        <>
          {(nameChanged || urlChanged || methodChanged || descriptionChanged) && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Overview</span>
              {nameChanged && <FieldDiffRow label="Name" before={nameChanged.before} after={nameChanged.after} />}
              {urlChanged && <FieldDiffRow label="URL" before={urlChanged.before} after={urlChanged.after} />}
              {methodChanged && <FieldDiffRow label="Method" before={methodChanged.before} after={methodChanged.after} />}
              {descriptionChanged && (
                <FieldDiffRow label="Description" before={descriptionChanged.before} after={descriptionChanged.after} />
              )}
            </div>
          )}

          <KeyValueDiffRows title="Headers" rows={headerRows} />
          <KeyValueDiffRows title="Query Parameters" rows={parameterRows} />
          <KeyValueDiffRows title="Path Parameters" rows={pathParameterRows} />

          {bodyChanged && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Body</span>
              {bodyMimeTypeChanged && (
                <FieldDiffRow label="Content Type" before={diff.before?.body?.mimeType} after={diff.after?.body?.mimeType} />
              )}
              {bodyTextChanged && (
                <FieldDiffRow label="Content" before={diff.before?.body?.text} after={diff.after?.body?.text} />
              )}
              <KeyValueDiffRows title="Body Parameters" rows={bodyParamRows} />
            </div>
          )}

          {authFieldChanges.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Authentication</span>
              <div className="flex flex-col gap-2 pl-1">
                {authFieldChanges.map(change => (
                  <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
                ))}
              </div>
            </div>
          )}

          {otherChanges.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Other Changes</span>
              <ul className="flex flex-col gap-2">
                {otherChanges.map(change => (
                  <li key={change.path}>
                    <FieldDiffRow label={change.label} before={change.before} after={change.after} />
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
