import React from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { useFetcher } from 'react-router';

import { getAppWebsiteBaseURL } from '../../common/constants';
import type { CurrentPlan, PersonalPlanType, UserProfileResponse } from '../routes/organization';
import { Avatar } from './avatar';
import { Icon } from './icon';

const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free': {
      return 'Hobby';
    }
    case 'individual': {
      return 'Individual';
    }
    case 'team': {
      return 'Pro';
    }
    case 'enterprise': {
      return 'Enterprise';
    }
    case 'enterprise-member': {
      return 'Enterprise Member';
    }
    default: {
      return 'Free';
    }
  }
};

const UpgradeButton = ({ currentPlan }: { currentPlan: CurrentPlan }) => {
  // For the enterprise-member plan we don't show the upgrade button.
  if (currentPlan?.type === 'enterprise-member') {
    return null;
  }

  // If user has a team or enterprise plan we navigate them to the Enterprise contact page.
  if (['team', 'enterprise'].includes(currentPlan?.type || '')) {
    return (
      <a
        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        href={'https://insomnia.rest/pricing/contact'}
      >
        {currentPlan?.type === 'enterprise' ? '+ Add more seats' : 'Upgrade'}
      </a>
    );
  }

  let to = '/app/subscription/update?plan=individual&pay_schedule=year';

  if (currentPlan?.type === 'individual') {
    to = `/app/subscription/update?plan=team&pay_schedule=${currentPlan?.period}`;
  }

  return (
    <a
      href={getAppWebsiteBaseURL() + to}
      className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
    >
      Upgrade
    </a>
  );
};

interface UserButtonProps {
  user: UserProfileResponse;
  currentPlan?: CurrentPlan;
  isMinimal?: boolean;
}
export const HeaderUserButton = ({ user, currentPlan, isMinimal = false }: UserButtonProps) => {
  const logoutFetcher = useFetcher();

  return (
    <MenuTrigger>
      <Button
        data-testid="user-dropdown"
        className="flex flex-shrink-0 items-center justify-center gap-2 rounded-md px-1 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm]"
      >
        <Avatar src={user.picture} alt={user.name} />
        <span className="truncate">{user.name}</span>
        <Icon className="w-4 pr-2" icon={isMinimal ? 'caret-up' : 'caret-down'} />
      </Button>
      <Popover className="max-h-[85vh] min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none">
        {currentPlan && Boolean(currentPlan.type) && (
          <div className="text-md flex h-[--line-height-xs] w-full items-center justify-between gap-2 whitespace-nowrap border-b border-solid border-[--hl-sm] px-[--padding-md] pb-2 capitalize text-[--color-font]">
            <span>{currentPlan?.planName ?? formatCurrentPlanType(currentPlan.type)} Plan</span>
            <UpgradeButton currentPlan={currentPlan} />
          </div>
        )}
        <Menu
          className="focus:outline-none"
          onAction={action => {
            if (action === 'logout') {
              logoutFetcher.submit(
                {},
                {
                  action: '/auth/logout',
                  method: 'POST',
                },
              );
            }

            if (action === 'account-settings') {
              window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/settings/account`);
            }

            if (action === 'manage-organizations') {
              window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/dashboard/organizations`);
            }
          }}
        >
          <MenuItem
            id="manage-organizations"
            className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
            aria-label="Manage organizations"
          >
            <Icon icon="users" />
            <span>Manage Organizations</span>
          </MenuItem>
          <MenuItem
            id="account-settings"
            className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
            aria-label="Account settings"
          >
            <Icon icon="gear" />
            <span>Account Settings</span>
          </MenuItem>
          <MenuItem
            id="logout"
            className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
            aria-label="logout"
          >
            <Icon icon="sign-out" />
            <span>Log out</span>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
