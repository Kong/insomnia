import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { type FC, type ReactNode, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { Icon } from '../../icon';
import type { EntityDiff } from './diff-engine';
import type { DiffTabDef } from './diff-tabs';
import {
  CardHeaderActions,
  ChangeChip,
  CollapseToggleButton,
  DiffCardShell,
  type EntityCardActionProps,
  StatusDot,
} from './shared';

const TAB_CLASS =
  'flex h-full shrink-0 cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-sm) hover:text-(--color-font) aria-selected:bg-(--color-bg) aria-selected:text-(--color-font) data-focus-visible:ring-2 data-focus-visible:ring-(--hl-md) data-focus-visible:ring-inset';

export interface EntityHeaderBadge {
  label: string;
  className: string;
}

interface EntityHeaderLine {
  badge?: EntityHeaderBadge;
  icon?: IconProp;
  name?: string;
  // Secondary identifier shown after the name, eg. a URL or a mock route's status.
  detail?: string;
}

// Header lines for an entity identified by name + one detail (eg. URL): the old
// line is shown once any of `watchedPaths` (or the name) changed, and repeats
// the old badge and detail, plus the old name only if the name itself changed.
export function buildHeaderLines(
  diff: EntityDiff,
  {
    badgeOf,
    icon,
    detailOf,
    watchedPaths,
  }: {
    badgeOf?: (node: any) => EntityHeaderBadge;
    icon?: IconProp;
    detailOf?: (node: any) => string;
    watchedPaths: string[];
  },
): { current: EntityHeaderLine; previous?: EntityHeaderLine } {
  const node = diff.after ?? diff.before;
  const nameChange = diff.fieldChanges.find(change => change.path === 'name');
  const showPrevious = Boolean(nameChange) || diff.fieldChanges.some(change => watchedPaths.includes(change.path));
  return {
    current: { badge: badgeOf?.(node), icon, name: diff.name, detail: detailOf?.(node) },
    previous: showPrevious
      ? {
          badge: badgeOf?.(diff.before),
          name: nameChange ? String(nameChange.before ?? '') : undefined,
          detail: detailOf?.(diff.before),
        }
      : undefined,
  };
}

// `<badge|icon> <name> <detail>` on one line; when `previous` is given, a second
// struck-through line shows the old values.
export const EntityHeader: FC<{ current: EntityHeaderLine; previous?: EntityHeaderLine }> = ({ current, previous }) => (
  <div className="flex flex-1 flex-col gap-1 overflow-hidden">
    <div className="flex items-center gap-2 overflow-hidden">
      {current.badge && (
        <span className={`shrink-0 rounded-xs px-1.5 py-0.5 text-xs font-bold ${current.badge.className}`}>
          {current.badge.label}
        </span>
      )}
      {current.icon && <Icon icon={current.icon} className="shrink-0 text-(--hl)" />}
      <span className="shrink-0 font-semibold">{current.name}</span>
      {current.detail !== undefined && <span className="truncate font-mono text-sm text-(--hl)">{current.detail}</span>}
    </div>
    {previous && (
      <div className="flex items-center gap-2 overflow-hidden opacity-60">
        {previous.badge && (
          <span
            className={`shrink-0 rounded-xs px-1.5 py-0.5 text-[10px] font-bold line-through ${previous.badge.className}`}
          >
            {previous.badge.label}
          </span>
        )}
        {previous.name !== undefined && (
          <span className="shrink-0 text-xs font-normal text-(--hl) line-through">{previous.name}</span>
        )}
        {previous.detail !== undefined && (
          <span className="truncate font-mono text-xs text-(--color-font-danger) line-through">{previous.detail}</span>
        )}
      </div>
    )}
  </div>
);

// Card layout shared by every entity type with tabbed sections: header + actions,
// collapsible into clickable chips, expanding into tabs that mirror the app's editor.
export const TabbedDiffCard: FC<
  { diff: EntityDiff; header: ReactNode; tabs: DiffTabDef[] } & EntityCardActionProps
> = ({ diff, header, tabs, ...actionProps }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);

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
          {header}
        </div>
        <CardHeaderActions status={diff.status} {...actionProps} />
      </div>

      {!isExpanded && tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-7">
          {tabs.map(tab => (
            <ChangeChip
              key={tab.id}
              label={tab.label}
              status={tab.status}
              count={tab.count}
              onPress={() => openTab(tab.id)}
            />
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
