import type { FC } from 'react';

import {
  computeFieldChanges,
  dominantStatus,
  type EntityChangeStatus,
  type EntityDiff,
  type FieldChange,
  type KeyedDiffRow,
  sideStatus,
  valuesEqual,
} from './diff-engine';
import { FieldDiffRow, StatusBadge, ValueChange } from './shared';

// One changed section of an entity, rendered as a tab (expanded card) or a chip (collapsed card).
export interface DiffTabDef {
  id: string;
  label: string;
  status: EntityChangeStatus;
  count?: number;
  content: FC;
}

export function compactTabs(tabs: (DiffTabDef | null | undefined | false)[]): DiffTabDef[] {
  return tabs.flatMap(tab => (tab ? [tab] : []));
}

// Renders a name/value key-value row the same way the app's own header/param
// editors do, instead of dumping the raw {name, value, disabled} object as JSON.
// `labelOf` lets rows matched by an opaque key (eg. an id) display a readable name;
// `getRowValue` picks what an added/removed row shows for items without a `value`.
// (Not named `valueOf`: an omitted prop would then resolve to Object.prototype.valueOf.)
export interface KeyValueRowFormat {
  labelOf?: (row: KeyedDiffRow) => string;
  getRowValue?: (item: any) => string | undefined;
}

const defaultRowValue = (item: any) => item?.value ?? item?.fileName;

export const KeyValueDiffRows: FC<{ title?: string; rows: KeyedDiffRow[] } & KeyValueRowFormat> = ({
  title,
  rows,
  labelOf = row => row.key,
  getRowValue = defaultRowValue,
}) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      {title && <span className="text-xs font-bold text-(--hl) uppercase">{title}</span>}
      <ul className="flex flex-col gap-2">
        {rows.map(row => {
          const item = (row.after ?? row.before) as { disabled?: boolean } | undefined;

          if (row.status === 'modified') {
            const fieldChanges = computeFieldChanges(row.before, row.after);
            return (
              <li key={row.key} className="flex flex-col gap-2 rounded-xs bg-(--color-bg) p-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={row.status} />
                  <span className="font-mono text-sm font-medium">{labelOf(row)}</span>
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
            <li
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xs bg-(--color-bg) p-2"
            >
              <div className="flex items-center gap-2">
                <StatusBadge status={row.status} />
                <span className="font-mono text-sm font-medium">{labelOf(row)}</span>
                {item?.disabled && <span className="text-xs text-(--hl)">(disabled)</span>}
              </div>
              <span
                className={`truncate font-mono text-sm ${isAdded ? 'text-(--color-font-success)' : 'text-(--color-font-danger) line-through'}`}
              >
                {getRowValue(item) ?? '(empty)'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Rows for a plain `{ key: value }` record (eg. folder environment variables). Unlike
// KeyValueDiffRows, values are shown whole rather than broken down field by field.
export const RecordDiffRows: FC<{ rows: KeyedDiffRow[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map(row => (
        <li key={row.key} className="flex flex-col gap-1 rounded-xs bg-(--color-bg) p-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status} />
            <span className="font-mono text-sm">{row.key}</span>
          </div>
          <ValueChange before={row.before} after={row.after} />
        </li>
      ))}
    </ul>
  );
};

const FieldChangeList: FC<{ changes: FieldChange[] }> = ({ changes }) => (
  <div className="flex flex-col gap-3">
    {changes.map(change => (
      <FieldDiffRow key={change.path} label={change.label} before={change.before} after={change.after} />
    ))}
  </div>
);

// A tab listing keyed rows (headers, params, metadata, ...), optionally split into titled sections.
export function keyValueTab({
  id,
  label,
  sections,
  ...format
}: {
  id: string;
  label: string;
  sections: { title?: string; rows: KeyedDiffRow[] }[];
} & KeyValueRowFormat): DiffTabDef | null {
  const rows = sections.flatMap(section => section.rows);
  if (rows.length === 0) {
    return null;
  }
  return {
    id,
    label,
    status: dominantStatus(rows.map(row => row.status)),
    count: rows.length,
    content: () => (
      <div className="flex flex-col gap-3">
        {sections.map((section, index) => (
          <KeyValueDiffRows key={section.title ?? index} title={section.title} rows={section.rows} {...format} />
        ))}
      </div>
    ),
  };
}

// A tab of before/after rows for the changed fields of one sub-object (eg. settings, reflection API config).
export function fieldChangesTab({
  id,
  label,
  before,
  after,
  status,
}: {
  id: string;
  label: string;
  before: unknown;
  after: unknown;
  status?: EntityChangeStatus;
}): DiffTabDef | null {
  const changes = computeFieldChanges(before, after);
  if (changes.length === 0) {
    return null;
  }
  return {
    id,
    label,
    status: status ?? sideStatus(before !== undefined, after !== undefined),
    count: changes.length,
    content: () => <FieldChangeList changes={changes} />,
  };
}

function isMeaningfulAuth(auth: any) {
  return Boolean(auth?.type) && auth.type !== 'none';
}

export function authTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.authentication;
  const after = diff.after?.authentication;
  const changes = computeFieldChanges(before, after);
  if (!(isMeaningfulAuth(before) || isMeaningfulAuth(after)) || changes.length === 0) {
    return null;
  }
  return {
    id: 'auth',
    label: 'Auth',
    status: sideStatus(isMeaningfulAuth(before), isMeaningfulAuth(after)),
    content: () => <FieldChangeList changes={changes} />,
  };
}

function hasScriptContent(scripts: any) {
  return Boolean(scripts?.preRequest || scripts?.afterResponse);
}

export function scriptsTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.scripts;
  const after = diff.after?.scripts;
  const changes = computeFieldChanges(before, after);
  if (changes.length === 0) {
    return null;
  }
  return {
    id: 'scripts',
    label: 'Scripts',
    status: sideStatus(hasScriptContent(before), hasScriptContent(after)),
    content: () => <FieldChangeList changes={changes} />,
  };
}

export function docsTab(diff: EntityDiff): DiffTabDef | null {
  const before = diff.before?.meta?.description;
  const after = diff.after?.meta?.description;
  if (valuesEqual(before, after) || !(before || after)) {
    return null;
  }
  return {
    id: 'docs',
    label: 'Docs',
    status: sideStatus(Boolean(before), Boolean(after)),
    content: () => <FieldDiffRow label="Description" before={before} after={after} />,
  };
}

// Catch-all for every changed field no dedicated tab/header covers, so no change is ever hidden.
export function settingsTab(diff: EntityDiff, handledPaths: ReadonlySet<string>): DiffTabDef | null {
  const otherChanges = diff.fieldChanges.filter(change => !handledPaths.has(change.path));
  if (otherChanges.length === 0) {
    return null;
  }
  return {
    id: 'settings',
    label: 'Settings',
    status: 'modified',
    count: otherChanges.length,
    content: () => <FieldChangeList changes={otherChanges} />,
  };
}
