import React from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import { getAppWebsiteBaseURL } from '../../common/constants';
import type { CurrentPlan, PersonalPlanType, UserProfileResponse } from '../routes/organization';
import { Avatar } from './avatar';
import { Icon } from './icon';

const formatCurrentPlanType = (type: PersonalPlanType) => {
  switch (type) {
    case 'free':
      return 'Hobby';
    case 'individual':
      return 'Individual';
    case 'team':
      return 'Pro';
    case 'enterprise':
      return 'Enterprise';
    case 'enterprise-member':
      return 'Enterprise Member';
    default:
      return 'Free';
  }
};

const UpgradeButton = ({
  currentPlan,
}: {
  currentPlan: CurrentPlan;
}) => {

  // For the enterprise-member plan we don't show the upgrade button.
  if (currentPlan?.type === 'enterprise-member') {
    return null;
  }

  // If user has a team or enterprise plan we navigate them to the Enterprise contact page.
  if (['team', 'enterprise'].includes(currentPlan?.type || '')) {
    return (
      <a
        className="px-4 text-[--color-font] hover:bg-[--hl-xs] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
      className="px-4 text-[--color-font] hover:bg-[--hl-xs] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
export const HeaderUserButton = ({
  user,
  currentPlan,
  isMinimal = false,
}: UserButtonProps) => {
  const logoutFetcher = useFetcher();

  return (
    <MenuTrigger>
      <Button data-testid='user-dropdown' className="px-1 py-1 flex-shrink-0 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <Avatar
          src={user.picture}
          alt={user.name}
        />
        <span className="truncate">
          {user.name}
        </span>
        <Icon className='w-4 pr-2' icon={isMinimal ? 'caret-up' : 'caret-down'} />
      </Button>
      <Popover className="min-w-max border select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none">
        {currentPlan && Boolean(currentPlan.type) && (
          <div className='flex gap-2 justify-between items-center pb-2 px-[--padding-md] border-b border-solid border-[--hl-sm] text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap capitalize'>
            <span>{currentPlan?.planName ?? formatCurrentPlanType(currentPlan.type)} Plan</span>
            <UpgradeButton currentPlan={currentPlan} />
          </div>
        )}
        <Menu
          className='focus:outline-none'
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
              window.main.openInBrowser(
                `${getAppWebsiteBaseURL()}/app/settings/account`,
              );
            }

            if (action === 'manage-organizations') {
              window.main.openInBrowser(
                `${getAppWebsiteBaseURL()}/app/dashboard/organizations`
              );
            }
          }}
        >
          <MenuItem
            id="manage-organizations"
            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
            aria-label="Manage organizations"
          >
            <Icon icon="users" />
            <span>Manage Organizations</span>
          </MenuItem>
          <MenuItem
            id="account-settings"
            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
            aria-label="Account settings"
          >
            <Icon icon="gear" />
            <span>Account Settings</span>
          </MenuItem>
          <MenuItem
            id="logout"
            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
