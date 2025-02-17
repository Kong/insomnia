import { useState } from 'react';
import React from 'react';
import type { Key } from 'react-aria-components';
import { Button, Menu, MenuItem, MenuTrigger, Popover, Text } from 'react-aria-components';

import { showAlert } from '..';

export interface Role {
  id: string;
  name: string;
  description?: string;
}

interface AllowChangeRole {
  allow: boolean;
  title: string;
  message: string;
}

interface CheckIfAllowProps {
  isUserOrganizationOwner?: boolean;
  role?: Role;
  isRBACEnabled?: boolean;
  hasPermissionToChangeRoles?: boolean;
}

const checkIfAllow = ({
  isUserOrganizationOwner = false,
  role,
  isRBACEnabled = false,
  hasPermissionToChangeRoles = false,
}: CheckIfAllowProps): AllowChangeRole => {
  const allow = { allow: true, title: '', message: '' };

  if (isUserOrganizationOwner) {
    if (!isRBACEnabled) {
      return {
        allow: false,
        title: 'Upgrade your plan',
        message: 'Role-based access control (RBAC) is only enabled for Team plan or above, please upgrade your plan.',
      };
    }

    return allow;
  }

  if (role?.name === 'member') {
    if (!isRBACEnabled) {
      return {
        allow: false,
        title: 'Upgrade required',
        message:
          'Role-based access control (RBAC) is only enabled for Team plan or above, please contact the owner to upgrade the plan.',
      };
    }

    if (!hasPermissionToChangeRoles) {
      return {
        allow: false,
        title: 'Permission required',
        message: 'You don\'t have permission to make this action, please contact the organization owner.',
      };
    }

    return allow;
  }

  return allow;
};

export enum SELECTOR_TYPE {
  UPDATE = 'update',
  INVITE = 'invite',
};

interface Props {
  type: SELECTOR_TYPE.UPDATE | SELECTOR_TYPE.INVITE;
  availableRoles: Role[];
  memberRoles: string[];
  userRole?: Role;
  hasPermissionToChangeRoles?: boolean;
  isUserOrganizationOwner?: boolean;
  isRBACEnabled?: boolean;
  isDisabled?: boolean;
  className?: string;
  onRoleChange: (role: Role) => Promise<void>;
}

export const OrganizationMemberRolesSelector = (props: Props) => {
  const {
    type,
    availableRoles,
    memberRoles,
    isDisabled,
    className,
    userRole,
    hasPermissionToChangeRoles,
    isUserOrganizationOwner,
    isRBACEnabled,
    onRoleChange,
  } = props;
  const [selectedRoles, setSelectedRoles] = useState<string[]>(memberRoles);

  const handleRoleChange = (selectedRole: Role) => {
    if (type === SELECTOR_TYPE.UPDATE) {
      const { allow, title, message } = checkIfAllow({
        isUserOrganizationOwner,
        role: userRole,
        isRBACEnabled,
        hasPermissionToChangeRoles,
      });

      if (!allow) {
        showAlert({
          title,
          message,
        });
      } else {
        setSelectedRoles([selectedRole.name]);
        onRoleChange(selectedRole).catch(() => {
          setSelectedRoles([...selectedRoles] as string[]);
        });
      }
    } else {
      setSelectedRoles([selectedRole.name]);
      onRoleChange(selectedRole).catch(() => {
        setSelectedRoles([...selectedRoles] as string[]);
      });
    }
  };

  return (
    <>
      <MenuTrigger>
        <Button
          isDisabled={isDisabled}
          aria-label="Menu"
          className={`px-[8px] w-full pressed:bg-opacity-40 flex items-center gap-[8px] rounded-full bg-opacity-20 bg-clip-padding outline-none transition-colors hover:bg-opacity-30 disabled:opacity-40 ${className}`}
        >
          <p className="flex-1 m-0 text-[12px] font-normal capitalize tracking-[-0.25px] text-center">
            {selectedRoles?.length ? selectedRoles[0] : 'Member'}
          </p>
          <i className="fa fa-caret-down" />
        </Button>
        <Popover
          placement="bottom end"
          className="entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 w-56 min-w-[300px] origin-top-left overflow-auto rounded-md p-1 border-solid border-white/20 border bg-[--color-bg]"
        >
          <Menu
            className="outline-none"
            items={availableRoles.filter(r => r.name !== 'owner')}
            disabledKeys={['owner']}
            aria-label="Select a role for the user"
            onAction={(key: Key) => {
              handleRoleChange(availableRoles.filter(r => r.name === key)[0]);
            }}
          >
            {item => (
              <MenuItem
                id={item.name}
                key={item.name}
                aria-label="Select role"
                className={({ isDisabled }) =>
                  `hover:bg-[--hl-xs] group box-border flex w-full cursor-default flex-col rounded-md px-3 py-2 outline-none text-[--color-font] ${isDisabled ? 'opacity-40' : 'cursor-pointer'
                  }`
                }
              >
                <div className="flex items-center gap-[5px]">
                  <Text
                    slot="label"
                    className="text-[14px] font-[700] capitalize leading-[28px] tracking-[-0.25px]"
                  >
                    {item.name}
                  </Text>
                  {selectedRoles?.length
                    ? selectedRoles?.includes(item.name) && <i className="fa fa-check h-3 w-3 text-primary" />
                    : item.name === 'member' && <i className="fa fa-check h-3 w-3 text-primary" />}
                </div>
                <Text
                  slot="description"
                  className="whitespace-pre-wrap text-[14px] font-normal leading-[18px] tracking-[-0.25px]"
                >
                  {item.description}
                </Text>
              </MenuItem>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
    </>
  );
};
