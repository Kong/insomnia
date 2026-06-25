import type { CurrentPlan, Organization } from 'insomnia-api';
import { Fragment, useEffect, useState } from 'react';
import { Button, Input, ListBox, ListBoxItem, Popover, SearchField, Select, SelectValue } from 'react-aria-components';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { getLoginUrl } from '~/ui/auth-session-provider.client';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';

import { Icon } from '../icon';

interface OrganizationSelectProps {
  organizationId: string;
  organizations: Organization[];
  onSelect: (id: string) => void;
  currentPlan?: CurrentPlan;
  isScratchpadWorkspace: boolean;
}

export const OrganizationSelect = ({
  organizationId,
  organizations,
  onSelect,
  currentPlan,
  isScratchpadWorkspace,
}: OrganizationSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFilterText('');
    }
  }, [isOpen]);

  const filteredOrgs = organizations.filter(org =>
    org.display_name.toLowerCase().includes(filterText.toLowerCase()),
  );

  return (
    <div className="flex h-10 flex-col items-start justify-center p-(--padding-sm)">
      <Select
        aria-label="Organizations"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onChange={id => {
          onSelect(String(id));
        }}
        value={organizationId}
      >
        <Button className="flex flex-1 items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
          <SelectValue<Organization> className="flex items-center justify-center gap-2 truncate">
            {({ selectedItems }) => {
              return selectedItems?.[0]?.display_name || 'Select an organization';
            }}
          </SelectValue>
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none">
          {organizations.length > 8 && (
            <div className="px-(--padding-md) pb-2">
              <SearchField
                aria-label="Filter organizations"
                className="group relative"
                value={filterText}
                onChange={setFilterText}
              >
                <Input
                  placeholder="Filter organizations..."
                  className="w-full rounded border border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-sm text-(--color-font) placeholder:text-(--hl-md) focus:outline-hidden focus:ring-1 focus:ring-(--hl-md)"
                  autoComplete="off"
                />
                <div className="absolute top-0 right-0 flex h-full items-center px-2">
                  <Button
                    aria-label="Clear filter"
                    className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  >
                    <Icon icon="close" />
                  </Button>
                </div>
              </SearchField>
            </div>
          )}
          <ListBox
            items={filteredOrgs}
            className="max-h-80 min-w-max overflow-y-auto focus:outline-hidden"
            renderEmptyState={() => (
              <div className="px-(--padding-md) py-2 italic text-(--hl-md)">No matching organizations</div>
            )}
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
          <div className="my-1 border-t border-(--hl-sm)" />
          <Button
            className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden"
            onPress={() => {
              setIsOpen(false);
              window.main.openInBrowser(getLoginUrl());
            }}
          >
            <Icon icon="sign-in-alt" />
            <span>Join an organization</span>
          </Button>
          <Button
            className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden"
            onPress={() => {
              setIsOpen(false);
              // If user is in the scratchpad workspace redirect them to the login page
              if (isScratchpadWorkspace) {
                return window.main.openInBrowser(getLoginUrl());
              }

              if (!currentPlan) {
                return;
              }

              if (currentPlan.type === 'enterprise-member') {
                // If user has a team or enterprise member plan show them an alert
                showModal(AlertModal, {
                  title: 'Cannot create new organization.',
                  message:
                    'Your Insomnia account is tied to the enterprise corporate account. Please ask the owner of the enterprise billing to create one for you.',
                });
              } else if (['free', 'individual'].includes(currentPlan.type)) {
                // If user has a free or individual plan redirect them to the landing page
                window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/landing-page`);
              } else {
                // If user has a team or enterprise plan redirect them to the create organization page
                window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/dashboard/organizations?create_org=true`);
              }
            }}
          >
            <Icon icon="plus" />
            <span>Create an organization</span>
          </Button>
        </Popover>
      </Select>
    </div>
  );
};
