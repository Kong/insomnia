import type { ReactNode } from 'react';
import { Button, Input, SearchField } from 'react-aria-components';

import { Icon } from '../../icon';

interface SidebarHeaderProps {
  isScratchPad: boolean;
  tabs: { name: 'projects' | 'konnect'; label: ReactNode }[];
  activeTab: 'projects' | 'konnect';
  onTabChange: (tab: 'projects' | 'konnect') => void;
  filterValue: string;
  onFilterChange: (value: string) => void;
  isFilterDisabled: boolean;
  actionButton: ReactNode;
}

// Sidebar header component including project & konnect tabs, filter input, and action button.
export const SidebarHeader = ({
  isScratchPad,
  tabs,
  activeTab,
  onTabChange,
  filterValue,
  onFilterChange,
  isFilterDisabled,
  actionButton,
}: SidebarHeaderProps) => (
  <>
    <div className="flex h-[41px] shrink-0 border-b border-solid border-b-(--hl-md)">
      {!isScratchPad &&
        tabs.map(({ name, label }) => (
          <button
            type="button"
            key={name}
            className={`px-3 py-1 ${activeTab === name ? 'bg-(--hl-xs) text-(--color-font)' : 'text-(--hl) hover:bg-(--hl-sm) hover:text-(--color-font)'}`}
            data-testid={`sidebar-tab-${name}`}
            onClick={() => onTabChange(name)}
          >
            {label}
          </button>
        ))}
    </div>
    <div className="flex justify-between gap-1 p-(--padding-sm)">
      <SearchField
        aria-label="Projects filter"
        className="group relative flex-1"
        value={filterValue}
        isDisabled={isFilterDisabled}
        onChange={onFilterChange}
      >
        <Input
          placeholder="Filter"
          className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
        />
        <div className="absolute top-0 right-0 flex h-full items-center px-2">
          <Button
            aria-label="Clear search"
            className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon icon="close" />
          </Button>
        </div>
      </SearchField>
      {actionButton}
    </div>
  </>
);
