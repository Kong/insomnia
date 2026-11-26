import type { FC } from 'react';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import { computeFieldChanges, diffByKey, type EntityDiff, sideStatus, valuesEqual } from './diff-engine';
import { type DiffTabDef, docsTab, KeyValueDiffRows, withSettingsTab } from './diff-tabs';
import { buildRequestTabs } from './request-diff-card';
import { type EntityCardActionProps, FieldDiffRow } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// Fields this card shows outside its Settings catch-all. `request` is covered by the header
// (method and URL) and the request tabs; without this it would fall through to the raw Settings
// catch-all when only method or URL changed.
const CARD_FIELD_PATHS = new Set(['name', 'request']);

// The example editor reuses the request editor for its request snapshot, so its tabs
// (params, body, auth, headers, scripts) are reused here too. They all belong to the
// example's `request` snapshot as far as the example-level catch-all is concerned.
function requestTabs(diff: EntityDiff): DiffTabDef[] {
  const before = diff.before?.request;
  const after = diff.after?.request;
  return buildRequestTabs({
    ...diff,
    before,
    after,
    fieldChanges: computeFieldChanges(before, after),
  }).map(tab => ({
    ...tab,
    // The request card's own catch-all (eg. headers that were only reordered) stays a tab of
    // its own, so an example-level Settings tab still means "outside the request snapshot".
    id: tab.id === 'settings' ? 'request-settings' : tab.id,
    label: tab.id === 'settings' ? 'Request settings' : tab.label,
    paths: ['request'],
  }));
}

// The response part of an example is a saved snapshot, not a live response, so it has no
// timeline: status, headers and body are all there is to show.
function responseTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.response;
  const after = diff.after?.response;
  const statusChanges = computeFieldChanges(
    { statusCode: before?.statusCode, statusMessage: before?.statusMessage },
    { statusCode: after?.statusCode, statusMessage: after?.statusMessage },
  );
  const headerRows = diffByKey(before?.headers, after?.headers, 'name');
  const bodyChanged = !valuesEqual(before?.body, after?.body);

  if (statusChanges.length === 0 && headerRows.length === 0 && !bodyChanged) {
    return null;
  }

  return {
    id: 'response',
    label: 'Response',
    status: sideStatus(Boolean(before), Boolean(after)),
    count: statusChanges.length + headerRows.length + (bodyChanged ? 1 : 0),
    paths: ['response'],
    content: () => (
      <div className="flex flex-col gap-3">
        {statusChanges.map(change => (
          <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
        ))}
        <KeyValueDiffRows title="Headers" rows={headerRows} />
        {bodyChanged && <FieldDiffRow label="Content" before={before?.body} after={after?.body} />}
      </div>
    ),
  };
}

export function buildExampleTabs(diff: EntityDiff): DiffTabDef[] {
  return withSettingsTab(diff, CARD_FIELD_PATHS, [...requestTabs(diff), responseTab(diff), docsTab(diff)]);
}

export const ExampleDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const request = (diff.after ?? diff.before)?.request;
  const currentMethod = request?.method || 'GET';
  // Header changes inside the request snapshot don't surface as top-level field changes,
  // so add them for the old-line preview of the method and URL.
  const header = buildHeaderLines(
    { ...diff, fieldChanges: [...diff.fieldChanges, ...computeFieldChanges(diff.before?.request, diff.after?.request)] },
    {
      badgeOf: node => {
        const label = formatMethodName(node?.request?.method || currentMethod);
        return { label, className: getRequestBadgeClassName(label) };
      },
      detailOf: node => node?.request?.url || '(no url)',
      watchedPaths: ['method', 'url'],
    },
  );

  return (
    <TabbedDiffCard
      diff={diff}
      header={<EntityHeader {...header} />}
      tabs={buildExampleTabs(diff)}
      {...actionProps}
    />
  );
};
