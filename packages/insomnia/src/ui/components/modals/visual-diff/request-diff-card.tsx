import { type FC, useMemo, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { formatMethodName, getRequestBadgeClassName } from '../../tags/method-tag';
import {
  computeFieldChanges,
  diffByKey,
  dominantStatus,
  type EntityChangeStatus,
  type EntityDiff,
  type KeyedDiffRow,
  sideStatus,
  valuesEqual,
} from './diff-engine';
import {
  CardHeaderActions,
  ChangeChip,
  CollapseToggleButton,
  DiffCardShell,
  type EntityCardActionProps,
  FieldDiffRow,
  StatusBadge,
  StatusDot,
} from './shared';

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

function isMeaningfulAuth(auth: any) {
  return Boolean(auth?.type) && auth.type !== 'none';
}

function hasBodyContent(body: any) {
  return Boolean(body?.mimeType || body?.text || body?.params?.length);
}

function hasScriptContent(scripts: any) {
  return Boolean(scripts?.preRequest || scripts?.afterResponse);
}

// Renders a name/value key-value row the same way the app's own header/param
// editors do, instead of dumping the raw {name, value, disabled} object as JSON.
const KeyValueDiffRows: FC<{ title?: string; rows: KeyedDiffRow[] }> = ({ title, rows }) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      {title && <span className="text-xs font-bold text-(--hl) uppercase">{title}</span>}
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

interface RequestTabDef {
  id: string;
  label: string;
  status: EntityChangeStatus;
  count?: number;
  content: FC;
}

const TAB_CLASS =
  'flex h-full shrink-0 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-sm) hover:text-(--color-font) aria-selected:bg-(--color-bg) aria-selected:text-(--color-font) data-focus-visible:ring-2 data-focus-visible:ring-(--hl-md) data-focus-visible:ring-inset';

export const RequestDiffCard: FC<{ diff: EntityDiff } & EntityCardActionProps> = ({ diff, staged, isPending, onStage }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

  const request = diff.after ?? diff.before;
  const method = request?.method || 'GET';

  const headerRows = useMemo(() => diffByKey(diff.before?.headers, diff.after?.headers, 'name'), [diff.before, diff.after]);
  const parameterRows = useMemo(() => diffByKey(diff.before?.parameters, diff.after?.parameters, 'name'), [diff.before, diff.after]);
  const pathParameterRows = useMemo(
    () => diffByKey(diff.before?.pathParameters, diff.after?.pathParameters, 'name'),
    [diff.before, diff.after],
  );
  const bodyParamRows = useMemo(
    () => diffByKey(diff.before?.body?.params, diff.after?.body?.params, 'name'),
    [diff.before, diff.after],
  );
  const authFieldChanges = useMemo(
    () => computeFieldChanges(diff.before?.authentication, diff.after?.authentication),
    [diff.before, diff.after],
  );
  const scriptFieldChanges = useMemo(
    () => computeFieldChanges(diff.before?.scripts, diff.after?.scripts),
    [diff.before, diff.after],
  );

  const nameChanged = diff.fieldChanges.find(c => c.path === 'name');
  const urlChanged = diff.fieldChanges.find(c => c.path === 'url');
  const methodChanged = diff.fieldChanges.find(c => c.path === 'method');
  const bodyMimeTypeChanged = !valuesEqual(diff.before?.body?.mimeType, diff.after?.body?.mimeType);
  const bodyTextChanged = !valuesEqual(diff.before?.body?.text, diff.after?.body?.text);
  const descriptionBefore = diff.before?.meta?.description;
  const descriptionAfter = diff.after?.meta?.description;
  const descriptionChanged = !valuesEqual(descriptionBefore, descriptionAfter);

  const hasAuthContent = isMeaningfulAuth(diff.before?.authentication) || isMeaningfulAuth(diff.after?.authentication);

  const otherChanges = diff.fieldChanges.filter(c => !HANDLED_FIELD_PATHS.has(c.path));

  const tabs: RequestTabDef[] = [];

  if (parameterRows.length > 0 || pathParameterRows.length > 0) {
    tabs.push({
      id: 'params',
      label: 'Params',
      status: dominantStatus([...parameterRows, ...pathParameterRows].map(row => row.status)),
      count: parameterRows.length + pathParameterRows.length,
      content: () => (
        <div className="flex flex-col gap-3">
          <KeyValueDiffRows title="Query Parameters" rows={parameterRows} />
          <KeyValueDiffRows title="Path Parameters" rows={pathParameterRows} />
        </div>
      ),
    });
  }

  if (bodyMimeTypeChanged || bodyTextChanged || bodyParamRows.length > 0) {
    tabs.push({
      id: 'body',
      label: 'Body',
      status: sideStatus(hasBodyContent(diff.before?.body), hasBodyContent(diff.after?.body)),
      content: () => (
        <div className="flex flex-col gap-3">
          {bodyMimeTypeChanged && (
            <FieldDiffRow label="Content Type" before={diff.before?.body?.mimeType} after={diff.after?.body?.mimeType} />
          )}
          {bodyTextChanged && <FieldDiffRow label="Content" before={diff.before?.body?.text} after={diff.after?.body?.text} />}
          <KeyValueDiffRows title="Form Parameters" rows={bodyParamRows} />
        </div>
      ),
    });
  }

  if (hasAuthContent && authFieldChanges.length > 0) {
    tabs.push({
      id: 'auth',
      label: 'Auth',
      status: sideStatus(isMeaningfulAuth(diff.before?.authentication), isMeaningfulAuth(diff.after?.authentication)),
      content: () => (
        <div className="flex flex-col gap-3">
          {authFieldChanges.map(change => (
            <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
          ))}
        </div>
      ),
    });
  }

  if (headerRows.length > 0) {
    tabs.push({
      id: 'headers',
      label: 'Headers',
      status: dominantStatus(headerRows.map(row => row.status)),
      count: headerRows.length,
      content: () => <KeyValueDiffRows rows={headerRows} />,
    });
  }

  if (scriptFieldChanges.length > 0) {
    tabs.push({
      id: 'scripts',
      label: 'Scripts',
      status: sideStatus(hasScriptContent(diff.before?.scripts), hasScriptContent(diff.after?.scripts)),
      content: () => (
        <div className="flex flex-col gap-3">
          {scriptFieldChanges.map(change => (
            <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
          ))}
        </div>
      ),
    });
  }

  if (descriptionChanged && (descriptionBefore || descriptionAfter)) {
    tabs.push({
      id: 'docs',
      label: 'Docs',
      status: sideStatus(Boolean(descriptionBefore), Boolean(descriptionAfter)),
      content: () => <FieldDiffRow label="Description" before={descriptionBefore} after={descriptionAfter} />,
    });
  }

  if (otherChanges.length > 0) {
    tabs.push({
      id: 'settings',
      label: 'Settings',
      status: 'modified',
      count: otherChanges.length,
      content: () => (
        <div className="flex flex-col gap-3">
          {otherChanges.map(change => (
            <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
          ))}
        </div>
      ),
    });
  }

  const activeTabId = selectedTabId && tabs.some(t => t.id === selectedTabId) ? selectedTabId : tabs[0]?.id;

  function openTab(tabId: string) {
    setSelectedTabId(tabId);
    setIsExpanded(true);
  }

  return (
    <DiffCardShell status={diff.status}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 items-center gap-1 overflow-hidden">
          <CollapseToggleButton isExpanded={isExpanded} onPress={() => setIsExpanded(!isExpanded)} />
          <div className="flex flex-1 flex-col gap-1 overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`shrink-0 rounded-xs px-1.5 py-0.5 text-xs font-bold ${getRequestBadgeClassName(formatMethodName(method))}`}>
                {formatMethodName(method)}
              </span>
              <span className="truncate font-mono text-sm text-(--hl)">{request?.url || '(no url)'}</span>
            </div>
            {(urlChanged || methodChanged) && (
              <div className="flex items-center gap-2 overflow-hidden opacity-60">
                <span
                  className={`shrink-0 rounded-xs px-1.5 py-0.5 text-[10px] font-bold line-through ${getRequestBadgeClassName(formatMethodName(diff.before?.method || method))}`}
                >
                  {formatMethodName(diff.before?.method || method)}
                </span>
                <span className="truncate font-mono text-xs text-(--color-font-danger) line-through">
                  {diff.before?.url || '(no url)'}
                </span>
              </div>
            )}
          </div>
        </div>
        <CardHeaderActions status={diff.status} staged={staged} isPending={isPending} onStage={onStage} />
      </div>

      <span className="pl-7 font-semibold">
        {diff.name}
        {nameChanged && (
          <span className="ml-2 text-xs font-normal text-(--hl) line-through">{String(nameChanged.before ?? '')}</span>
        )}
      </span>

      {!isExpanded && tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {tabs.map(tab => (
            <ChangeChip key={tab.id} label={tab.label} status={tab.status} count={tab.count} onPress={() => openTab(tab.id)} />
          ))}
        </div>
      )}

      {isExpanded && tabs.length > 0 && (
        <Tabs
          className="flex flex-col overflow-hidden"
          selectedKey={activeTabId}
          onSelectionChange={key => setSelectedTabId(String(key))}
        >
          <TabList
            aria-label="Changed sections"
            className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-solid border-b-(--hl-sm)"
          >
            {tabs.map(tab => (
              <Tab key={tab.id} id={tab.id} className={TAB_CLASS}>
                <StatusDot status={tab.status} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-(--hl-sm) px-1 text-xs">
                    {tab.count}
                  </span>
                )}
              </Tab>
            ))}
          </TabList>
          {tabs.map(tab => {
            const Content = tab.content;
            return (
              <TabPanel key={tab.id} id={tab.id} className="pt-3">
                <Content />
              </TabPanel>
            );
          })}
        </Tabs>
      )}

      {isExpanded && tabs.length === 0 && <span className="pl-7 text-sm text-(--hl)">No further details to show.</span>}
    </DiffCardShell>
  );
};
