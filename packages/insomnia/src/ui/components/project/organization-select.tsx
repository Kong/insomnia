import type { Organization } from 'insomnia-api';
import { Fragment } from 'react';
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

import { Icon } from '../icon';

interface OrganizationSelectProps {
  organizationId: string;
  organizations: Organization[];
  onSelect: (id: string) => void;
}

export const OrganizationSelect = ({ organizationId, organizations, onSelect }: OrganizationSelectProps) => {
  return (
    <div className="flex h-10 flex-col items-start justify-center p-(--padding-sm)">
      <Select
        aria-label="Organizations"
        onSelectionChange={id => {
          onSelect(String(id));
        }}
        selectedKey={organizationId}
      >
        <Button className="flex flex-1 items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
          <SelectValue<Organization> className="flex items-center justify-center gap-2 truncate">
            {({ selectedItem }) => {
              return selectedItem?.display_name || 'Select an organization';
            }}
          </SelectValue>
          <Icon icon="caret-down" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden">
          <ListBox
            items={organizations}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            {item => (
              <ListBoxItem
                id={item.id}
                key={item.id}
                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                aria-label={item.display_name}
                textValue={item.display_name}
                value={item}
              >
                {({ isSelected }) => (
                  <Fragment>
                    <span>{item.display_name}</span>
                    {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                  </Fragment>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    </div>
  );
};
