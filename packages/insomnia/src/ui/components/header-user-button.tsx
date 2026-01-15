import { type CurrentPlan, type UserProfile } from 'insomnia-api';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { useLogoutFetcher } from '~/routes/auth.logout';
import { Avatar } from '~/ui/components/avatar';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { LogoutModal } from '~/ui/components/modals/logout-modal';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

interface UserButtonProps {
  user: UserProfile;
  currentPlan?: CurrentPlan;
  isMinimal?: boolean;
}
export const HeaderUserButton = ({ user, isMinimal = false }: UserButtonProps) => {
  const logoutFetcher = useLogoutFetcher();

  return (
    <MenuTrigger>
      <Button
        data-testid="user-dropdown"
        className="flex shrink-0 items-center justify-center gap-2 rounded-md px-1 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-sm)"
      >
        <Avatar src={user.picture} alt={user.name} />
        <Icon className="w-4 pr-2" icon={isMinimal ? 'caret-up' : 'caret-down'} />
      </Button>
      <Popover className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden">
        <Menu
          className="focus:outline-hidden"
          onAction={action => {
            if (action === 'logout') {
              showModal(LogoutModal, {
                onConfirm: async (clearCredentials: boolean) => {
                  await logoutFetcher.submit({ clearCredentials });
                },
              });
            }

            if (action === 'my-profile') {
              window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/settings/profile`);
            }

            if (action === 'preferences') {
              showSettingsModal();
            }
          }}
        >
          <MenuItem
            id="preferences"
            className="text-md flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
            aria-label="preferences"
          >
            <Icon icon="gear" />
            <span>Preferences</span>
          </MenuItem>
          <MenuItem
            id="my-profile"
            className="text-md flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
            aria-label="My profile"
          >
            <Icon icon="user" />
            <span>My Profile</span>
          </MenuItem>
          <MenuItem
            id="logout"
            className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
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
