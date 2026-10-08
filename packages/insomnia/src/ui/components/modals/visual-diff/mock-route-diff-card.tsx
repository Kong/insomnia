import type { FC } from 'react';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff, sideStatus, valuesEqual } from './diff-engine';
import { compactTabs, type DiffTabDef, docsTab, keyValueTab, settingsTab } from './diff-tabs';
import { type EntityCardActionProps, FieldDiffRow } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// The route's path lives in `name`; its status is shown in the header, like a request's URL.
const HANDLED_FIELD_PATHS = new Set([
  'name',
  'method',
  'statusCode',
  'statusText',
  'mimeType',
  'body',
  'headers',
  'meta.description',
]);

function bodyTab(diff: EntityDiff): DiffTabDef | null {
  const mimeTypeChanged = !valuesEqual(diff.before?.mimeType, diff.after?.mimeType);
  const bodyChanged = !valuesEqual(diff.before?.body, diff.after?.body);
  if (!mimeTypeChanged && !bodyChanged) {
    return null;
  }
  return {
    id: 'body',
    label: 'Body',
    status: sideStatus(Boolean(diff.before?.body), Boolean(diff.after?.body)),
    content: () => (
      <div className="flex flex-col gap-3">
        {mimeTypeChanged && (
          <FieldDiffRow label="Content Type" before={diff.before?.mimeType} after={diff.after?.mimeType} />
        )}
        {bodyChanged && <FieldDiffRow label="Content" before={diff.before?.body} after={diff.after?.body} />}
      </div>
    ),
  };
}

// Tabs mirror the mock route editor's response sections: Body and Headers (status is in the
// header), plus Docs and the diff-only Settings catch-all.
export function buildMockRouteTabs(diff: EntityDiff): DiffTabDef[] {
  return compactTabs([
    bodyTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ rows: diffByKey(diff.before?.headers, diff.after?.headers, 'name') }],
    }),
    docsTab(diff),
    settingsTab(diff, HANDLED_FIELD_PATHS),
  ]);
}

function statusOf(node: any) {
  if (!node) {
    return '';
  }
  return [node.statusCode ?? 200, node.statusText].filter(Boolean).join(' ');
}

export const MockRouteDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const currentMethod = (diff.after ?? diff.before)?.method || 'GET';
  const header = buildHeaderLines(diff, {
    badgeOf: node => {
      const label = formatMethodName(node?.method || currentMethod);
      return { label, className: getRequestBadgeClassName(label) };
    },
    detailOf: statusOf,
    watchedPaths: ['method', 'statusCode', 'statusText'],
  });

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader {...header} />}
      tabs={buildMockRouteTabs(diff)}
      {...actionProps}
    />
  );
};
