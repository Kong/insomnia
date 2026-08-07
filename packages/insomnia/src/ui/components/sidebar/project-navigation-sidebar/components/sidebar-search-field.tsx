import { Button, Input, SearchField } from 'react-aria-components';

import { Icon } from '../../../icon';

export const SidebarSearchField = ({
  value,
  isDisabled,
  onChange,
}: {
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
}) => (
  <SearchField
    aria-label="Projects filter"
    className="group relative flex-1"
    value={value}
    isDisabled={isDisabled}
    onChange={onChange}
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
);
