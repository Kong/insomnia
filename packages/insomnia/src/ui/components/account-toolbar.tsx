import React from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import * as session from '../../account/session';
import { usePresenceContext } from '../context/app/presence-context';
import { RootLoaderData } from '../routes/root';
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
  const data = useRouteLoaderData('root') as RootLoaderData;
  const { projectId, workspaceId } = useParams() as {
    workspaceId: string;
    projectId: string;
    organizationId: string;
  };

  const user = data?.user || {};

  const activeUsers = presence.filter(p => {
    return p.project === projectId && p.file === workspaceId;
  });

  const logoutFetcher = useFetcher();

  return (
    <Toolbar>
      {presence && (
        <AvatarGroup
          animate
          size="medium"
          items={activeUsers.map(activeUser => {
            return {
              key: activeUser.acct,
              alt:
                activeUser.firstName || activeUser.lastName
                  ? `${activeUser.firstName} ${activeUser.lastName}`
                  : activeUser.acct,
              src: activeUser.avatar,
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
            onClick={() => window.main.openInBrowser('https://app.insomnia.rest/app/account/')}
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
