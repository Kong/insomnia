
import React, { Fragment } from 'react';
import styled from 'styled-components';

import * as session from '../../account/session';
import { getAppWebsiteBaseURL } from '../../common/constants';
import { clickLink } from '../../common/electron-helpers';
import { UpgradeAccountButton } from './account-upgrade-button';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  ItemContent,
} from './base/dropdown';
import { Link as ExternalLink } from './base/link';
import { showLoginModal } from './modals/login-modal';
import { SvgIcon } from './svg-icon';
import { Button } from './themed-button';

const WebsiteURL = getAppWebsiteBaseURL();

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
  const user = session.getSession();
  return (
    <Toolbar>
      {isLoggedIn ? (
        <Dropdown
          aria-label="Account"
          triggerButton={
            <DropdownButton
              style={{ gap: 'var(--padding-xs)' }}
              removePaddings={false}
              disableHoverBehavior={false}
            >
              <SvgIcon icon="user" />
              {user?.firstName} {user?.lastName}
              <i className="fa fa-caret-down" />
            </DropdownButton>
          }
        >
          <DropdownItem key="account-settings" aria-label="Account settings">
            <ItemContent
              icon="gear"
              label="Account Settings"
              stayOpenAfterClick
              onClick={() =>
                clickLink(`${WebsiteURL}/app/account/`)
              }
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
            href={`${WebsiteURL}/app/signup/`}
            as={ExternalLink}
            size="small"
            variant="contained"
          >
            Sign Up
          </SignUpButton>
        </Fragment>
      )}
      {(isLoggedIn && user) && <UpgradeAccountButton user={user} />}
    </Toolbar>
  );
};
