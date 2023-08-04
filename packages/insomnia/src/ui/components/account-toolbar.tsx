import React from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import * as session from '../../account/session';
import { getAccountId } from '../../account/session';
import { getAppWebsiteBaseURL } from '../../common/constants';
import { usePresenceContext } from '../context/app/presence-context';
import { OrganizationLoaderData } from '../routes/organization';
import { Avatar, AvatarGroup } from './avatar';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  ItemContent,
} from './base/dropdown';

const Toolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  paddingRight: 'var(--padding-sm)',
  gap: 'var(--padding-sm)',
  margin: 0,
});

export const AccountToolbar = () => {
  const { presence } = usePresenceContext();
  const data = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { projectId, workspaceId } = useParams() as {
    workspaceId: string;
    projectId: string;
    organizationId: string;
  };

  const user = data?.user || {};

  const activeUsers = presence.filter(p => {
    return p.project === projectId && p.file === workspaceId;
  }).filter(p => p.acct !== getAccountId());

  const logoutFetcher = useFetcher();

  return (
    <Toolbar>
      {presence && (
        <AvatarGroup
          animate
          size="medium"
          items={activeUsers.map(user => {
            return {
              key: user.acct,
              alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
              src: user.avatar,
            };
          })}
        />
      )}
      <Dropdown
        aria-label="Account"
        triggerButton={
          <DropdownButton
            style={{
              gap: 'var(--padding-xs)',
              borderRadius: '60px',
              padding: '3px 3px',
              alignItems: 'center',
            }}
            removePaddings={false}
            disableHoverBehavior={false}
          >
            <Avatar
              src={user?.picture}
              alt={`${session.getFirstName()?.charAt(0)}${session
                .getLastName()
                ?.charAt(0)}`}
            />
            {session.getFirstName()} {session.getLastName()}
            <i className="fa fa-caret-down" />
          </DropdownButton>
        }
      >
        <DropdownItem key="account-settings" aria-label="Account settings">
          <ItemContent
            icon="gear"
            label="Account Settings"
            stayOpenAfterClick
            onClick={() => window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/settings/account`)}
          />
        </DropdownItem>
        <DropdownItem key="logout" aria-label="logout">
          <ItemContent
            icon="sign-out"
            label="Logout"
            withPrompt
            stayOpenAfterClick
            onClick={() => {
              logoutFetcher.submit({}, {
                action: '/auth/logout',
                method: 'POST',
              });
            }}
          />
        </DropdownItem>
      </Dropdown>
    </Toolbar>
  );
};
