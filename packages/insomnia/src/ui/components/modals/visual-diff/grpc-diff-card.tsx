import type { FC } from 'react';

import { getRequestBadgeClassName } from '../../tags/method-tag';
import { diffByKey, type EntityDiff, sideStatus, valuesEqual } from './diff-engine';
import { type DiffTabDef, docsTab, fieldChangesTab, keyValueTab, withSettingsTab } from './diff-tabs';
import { type EntityCardActionProps, FieldDiffRow } from './shared';
import { buildHeaderLines, EntityHeader, TabbedDiffCard } from './tabbed-diff-card';

// Fields shown in the card's header; every other changed field is shown by a tab or the Settings catch-all.
const HEADER_FIELD_PATHS = new Set(['name', 'url']);

function methodTab(diff: EntityDiff): DiffTabDef | null {
  const methodChanged = !valuesEqual(diff.before?.protoMethodName, diff.after?.protoMethodName);
  // Proto files aren't part of the git file, so only their id is available to show.
  const fileChanged = !valuesEqual(diff.before?.protoFileId, diff.after?.protoFileId);
  if (!methodChanged && !fileChanged) {
    return null;
  }
  return {
    id: 'method',
    label: 'Method',
    status: sideStatus(Boolean(diff.before?.protoMethodName), Boolean(diff.after?.protoMethodName)),
    paths: ['protoMethodName', 'protoFileId'],
    content: () => (
      <div className="flex flex-col gap-3">
        {methodChanged && (
          <FieldDiffRow label="Method" before={diff.before?.protoMethodName} after={diff.after?.protoMethodName} />
        )}
        {fileChanged && (
          <FieldDiffRow label="Proto File ID" before={diff.before?.protoFileId} after={diff.after?.protoFileId} />
        )}
      </div>
    ),
  };
}

function messageTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.body?.text;
  const after = diff.after?.body?.text;
  if (valuesEqual(before, after)) {
    return null;
  }
  return {
    id: 'message',
    label: 'Message',
    status: sideStatus(Boolean(before), Boolean(after)),
    content: () => <FieldDiffRow label="Message" before={before} after={after} />,
    paths: ['body'],
  };
}

// Tabs mirror the gRPC request editor: Method, Message, Headers (gRPC metadata), plus Reflection
// settings, Docs and the diff-only Settings catch-all.
export function buildGrpcTabs(diff: EntityDiff): DiffTabDef[] {
  return withSettingsTab(diff, HEADER_FIELD_PATHS, [
    methodTab(diff),
    messageTab(diff),
    keyValueTab({
      id: 'headers',
      label: 'Headers',
      sections: [{ path: 'metadata', rows: diffByKey(diff.before?.metadata, diff.after?.metadata, 'name') }],
    }),
    fieldChangesTab({
      id: 'reflection',
      label: 'Reflection',
      before: diff.before?.reflectionApi,
      after: diff.after?.reflectionApi,
      paths: ['reflectionApi'],
    }),
    docsTab(diff),
  ]);
}

const GRPC_BADGE = { label: 'gRPC', className: getRequestBadgeClassName('gRPC') };

export const GrpcDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, ...actionProps }) => {
  const header = buildHeaderLines(diff, {
    badgeOf: () => GRPC_BADGE,
    detailOf: node => node?.url || '(no url)',
    watchedPaths: ['url'],
  });

  return (
    <TabbedDiffCard diff={diff} header={<EntityHeader {...header} />} tabs={buildGrpcTabs(diff)} {...actionProps} />
  );
};
