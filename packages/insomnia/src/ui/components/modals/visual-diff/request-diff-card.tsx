import type { FC } from 'react';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff, type KeyedDiffRow } from './diff-engine';
import { DiffCardShell, formatValue, StatusBadge, ValueChange } from './shared';

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

const KeyedDiffRows: FC<{ title: string; rows: KeyedDiffRow[] }> = ({ title, rows }) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold">{title}</span>
      <ul className="flex flex-col gap-2">
        {rows.map(row => (
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
  );
};

export const RequestDiffCard: FC<{ diff: EntityDiff }> = ({ diff }) => {
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

  return (
    <DiffCardShell status={diff.status}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className={`shrink-0 rounded-xs px-1.5 py-0.5 text-xs font-bold ${getRequestBadgeClassName(formatMethodName(method))}`}>
            {formatMethodName(method)}
          </span>
          <span className="truncate font-mono text-sm text-(--hl)">{request?.url || '(no url)'}</span>
        </div>
        <StatusBadge status={diff.status} />
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
              {nameChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">Name</span>
                  <ValueChange before={nameChanged.before} after={nameChanged.after} />
                </div>
              )}
              {urlChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">URL</span>
                  <ValueChange before={urlChanged.before} after={urlChanged.after} />
                </div>
              )}
              {methodChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">Method</span>
                  <ValueChange before={methodChanged.before} after={methodChanged.after} />
                </div>
              )}
              {descriptionChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">Description</span>
                  <ValueChange before={descriptionChanged.before} after={descriptionChanged.after} />
                </div>
              )}
            </div>
          )}

          <KeyedDiffRows title="Headers" rows={headerRows} />
          <KeyedDiffRows title="Query Parameters" rows={parameterRows} />
          <KeyedDiffRows title="Path Parameters" rows={pathParameterRows} />

          {bodyChanged && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Body</span>
              {bodyMimeTypeChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">Content Type</span>
                  <ValueChange before={diff.before?.body?.mimeType} after={diff.after?.body?.mimeType} />
                </div>
              )}
              {bodyTextChanged && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-(--hl)">Content</span>
                  <ValueChange before={diff.before?.body?.text} after={diff.after?.body?.text} />
                </div>
              )}
              <KeyedDiffRows title="Body Parameters" rows={bodyParamRows} />
            </div>
          )}

          {authChanged && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Authentication</span>
              <ValueChange before={diff.before?.authentication} after={diff.after?.authentication} />
            </div>
          )}

          {otherChanges.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Other Changes</span>
              <ul className="flex flex-col gap-2">
                {otherChanges.map(change => (
                  <li key={change.path} className="flex flex-col gap-1">
                    <span className="text-xs text-(--hl)">{change.label}</span>
                    <ValueChange before={change.before} after={change.after} />
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
