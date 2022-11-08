import classNames from 'classnames';
import React, { Fragment } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import * as session from '../../account/session';
import { selectSettings } from '../redux/selectors';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { Link } from './base/link';
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
  marginleft: 'var(--padding-md)',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 'var(--padding-xs)',
  paddingRight: 'var(--padding-md)',
  width: 'unset !important',
});

const SignUpButton = styled(Button)({
  '&&': {
    backgroundColor: 'var(--color-info)',
    color: 'var(--color-font-info)',
    textDecoration: 'none',
    margin: 0,
    boxSizing: 'border-box',
  },
});

export const AccountToolbar = () => {
  const { disablePaidFeatureAds } = useSelector(selectSettings);
  const isLoggedIn = session.isLoggedIn();

  return (
    <Toolbar>
      {isLoggedIn ? (
        <Dropdown>
          <DropdownButton noWrap>
            <Tooltip delay={1000} position="bottom" message="Account">
              <Button size='small' style={{ gap: 'var(--padding-xs)' }} variant='text'>
                {isLoggedIn && (<><SvgIcon icon='user' />{session.getFirstName()} {session.getLastName()}<i className="fa fa-caret-down" /></>)}
                {!isLoggedIn && (<><SvgIcon icon='user' /></>)}
              </Button>
            </Tooltip>
          </DropdownButton>
          {session.isLoggedIn() ? (
            <DropdownItem
              key="login"
              stayOpenAfterClick
              buttonClass={PromptButton}
              onClick={session.logout}
            >
              <StyledIcon faIcon="fa-sign-out" />Logout
            </DropdownItem>
          ) : (
            <Fragment>
              <DropdownItem key="login" onClick={showLoginModal}>
                <StyledIcon faIcon="fa-sign-in" />Log In
              </DropdownItem>
              {!disablePaidFeatureAds && (
                <DropdownItem
                  key="invite"
                  buttonClass={Link}
                  // @ts-expect-error -- TSCONVERSION appears to be genuine
                  href="https://insomnia.rest/pricing"
                  button
                >
                  <StyledIcon faIcon="fa-users" />{' '}Upgrade Now
                  <i className="fa fa-star surprise fa-outline" />
                </DropdownItem>
              )}
            </Fragment>
          )}
        </Dropdown>
      ) : (
        <Fragment>
          <Button variant='text' size="small" onClick={showLoginModal}>
            Login
          </Button>
          <SignUpButton href="https://insomnia.rest/pricing" as={Link} size="small" variant='contained' onClick={showLoginModal}>
            Sign Up
          </SignUpButton>
        </Fragment>
      )}
    </Toolbar>
  );
};
