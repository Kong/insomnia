import React, { Fragment } from 'react';
import { useLoaderData, useParams } from 'react-router-dom';
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
import { Link as ExternalLink } from './base/link';
import { showLoginModal } from './modals/login-modal';
import { Button } from './themed-button';

const Toolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  paddingRight: 'var(--padding-sm)',
  gap: 'var(--padding-sm)',
  margin: 0,
});

const SignUpButton = styled(Button)({
  '&&': {
    backgroundColor: 'var(--color-surprise)',
    color: 'var(--color-font-surprise)',
    textDecoration: 'none',
    margin: 0,
    boxSizing: 'border-box',
  },
});

export const AccountToolbar = () => {
  const isLoggedIn = session.isLoggedIn();
  const { presence } = usePresenceContext();
  const { user } = useLoaderData() as RootLoaderData;
  const { projectId, workspaceId } = useParams() as {
    workspaceId: string;
    projectId: string;
  };

  const activeUsers = presence.filter(p => {
    return p.project === projectId && p.file === workspaceId;
  });

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
      {isLoggedIn && (
        <Button
          as={ExternalLink}
          href={'https://app.insomnia.rest/app/account/invite/'}
        >
          Invite
        </Button>
      )}
      {isLoggedIn ? (
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
              onClick={session.logout}
            />
          </DropdownItem>
        </Dropdown>
      ) : (
        <Fragment>
          <Button variant="outlined" size="small" onClick={showLoginModal}>
            Login
          </Button>
          <SignUpButton
            href="https://app.insomnia.rest/app/signup/"
            as={ExternalLink}
            size="small"
            variant="contained"
          >
            Sign Up
          </SignUpButton>
        </Fragment>
      )}
    </Toolbar>
  );
};
