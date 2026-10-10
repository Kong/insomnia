import type { FC } from 'react';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff, sideStatus, valuesEqual } from './diff-engine';
import {
  authTab,
  compactTabs,
  type DiffTabDef,
  docsTab,
  KeyValueDiffRows,
  keyValueTab,
  scriptsTab,
  settingsTab,
} from './diff-tabs';
import { type EntityCardActionProps, FieldDiffRow } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// Fields already surfaced by a dedicated tab/header row — everything else
// modified on the request node falls into the (diff-only) Settings tab.
const HANDLED_FIELD_PATHS = new Set([
  'name',
  'url',
  'method',
  'headers',
  'parameters',
  'pathParameters',
  'body',
  'authentication',
  'scripts',
  'meta.description',
]);

function hasBodyContent(body: any) {
  return Boolean(body?.mimeType || body?.text || body?.params?.length);
}

function bodyTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.body;
  const after = diff.after?.body;
  const mimeTypeChanged = !valuesEqual(before?.mimeType, after?.mimeType);
  const textChanged = !valuesEqual(before?.text, after?.text);
  const paramRows = diffByKey(before?.params, after?.params, 'name');
  if (!mimeTypeChanged && !textChanged && paramRows.length === 0) {
    return null;
  }
  return {
    id: 'body',
    label: 'Body',
    status: sideStatus(hasBodyContent(before), hasBodyContent(after)),
    content: () => (
      <div className="flex flex-col gap-3">
        {mimeTypeChanged && <FieldDiffRow label="Content Type" before={before?.mimeType} after={after?.mimeType} />}
        {textChanged && <FieldDiffRow label="Content" before={before?.text} after={after?.text} />}
        <KeyValueDiffRows title="Form Parameters" rows={paramRows} />
      </div>
    ),
  };
}

// Tabs mirror the request editor: Params, Body, Auth, Headers, Scripts, Docs, plus a diff-only Settings catch-all.
export function buildRequestTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    keyValueTab({
      id: 'params',
      label: 'Params',
      sections: [
        { title: 'Query Parameters', rows: diffByKey(diff.before?.parameters, diff.after?.parameters, 'name') },
        { title: 'Path Parameters', rows: diffByKey(diff.before?.pathParameters, diff.after?.pathParameters, 'name') },
      ],
    }),
    bodyTab(diff),
    authTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    scriptsTab(diff),
    docsTab(diff),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

export const RequestDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const currentMethod = (diff.after ?? diff.before)?.method || 'GET';
  const header = buildHeaderLines(diff, {
    badgeOf: node => {
      const label = formatMethodName(node?.method || currentMethod);
      return { label, className: getRequestBadgeClassName(label) };
    },
    detailOf: node => node?.url || '(no url)',
    watchedPaths: ['url', 'method'],
  });

  return (
    <TabbedDiffCard diff={diff} header={<EntityHeader {...header} />} tabs={buildRequestTabs(diff)} {...actionProps} />
  );
};
