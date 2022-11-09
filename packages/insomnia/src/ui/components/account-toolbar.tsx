import classNames from 'classnames';
import React, { Fragment } from 'react';
import styled from 'styled-components';

import * as session from '../../account/session';
import { clickLink } from '../../common/electron-helpers';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { Link as ExternalLink } from './base/link';
import { PromptButton } from './base/prompt-button';
import { showLoginModal } from './modals/login-modal';
import { SvgIcon } from './svg-icon';
import { Button } from './themed-button';
import { Tooltip } from './tooltip';

interface StyledIconProps {
  faIcon: string;
}

const Toolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  paddingRight: 'var(--padding-sm)',
  gap: 'var(--padding-sm)',
  margin: 0,
});

const StyledIcon = styled.i.attrs<StyledIconProps>(props => ({
  className: classNames('fa', props.faIcon),
}))<StyledIconProps>({
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 'var(--padding-xs)',
  paddingRight: 'var(--padding-md)',
  width: 'unset !important',
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

  return (
    <Toolbar>
      {isLoggedIn ? (
        <Dropdown>
          <DropdownButton noWrap>
            <Tooltip delay={1000} position="bottom" message="Account">
              <Button size='small' style={{ gap: 'var(--padding-xs)' }} variant='text'>
                <SvgIcon icon='user' />{session.getFirstName()} {session.getLastName()}<i className="fa fa-caret-down" />
              </Button>
            </Tooltip>
          </DropdownButton>
          <DropdownItem
            key="account-settings"
            stayOpenAfterClick
            onClick={() => clickLink('https://app.insomnia.rest/app/account/')}
          >
            <StyledIcon faIcon="fa-gear" /> Account Settings
          </DropdownItem>
          <DropdownItem
            key="logout"
            stayOpenAfterClick
            buttonClass={PromptButton}
            onClick={session.logout}
          >
            <StyledIcon faIcon="fa-sign-out" />Logout
          </DropdownItem>
        </Dropdown>
      ) : (
        <Fragment>
          <Button variant='outlined' size="small" onClick={showLoginModal}>
            Login
          </Button>
          <SignUpButton href="https://app.insomnia.rest/app/signup/" as={ExternalLink} size="small" variant='contained'>
            Sign Up
          </SignUpButton>
        </Fragment>
      )}
    </Toolbar>
  );
};
