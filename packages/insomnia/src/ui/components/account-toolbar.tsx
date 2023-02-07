import { Overlay, usePopover } from '@react-aria/overlays';
import { differenceInDays } from 'date-fns/esm';
import React, { Fragment, RefObject, useRef } from 'react';
import {
  AriaButtonProps,
  DismissButton,
  useButton,
  useDialog,
} from 'react-aria';
import { useOverlayTrigger } from 'react-aria';
import { useOverlayTriggerState } from 'react-stately';
import styled from 'styled-components';

import * as session from '../../account/session';
import { clickLink } from '../../common/electron-helpers';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  ItemContent,
} from './base/dropdown';
import { Link as ExternalLink } from './base/link';
import { showLoginModal } from './modals/login-modal';
import { SvgIcon } from './svg-icon';
import { Button, ButtonProps } from './themed-button';

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
  console.log('user: ', user);
  const userInTrialWithoutCreditCard = true; // user?.isTrialing && user?.isPaymentRequired;
  const userInIndividualPlan = false; // user?.planId === '';

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
                clickLink('https://app.insomnia.rest/app/account/')
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
            href="https://app.insomnia.rest/app/signup/"
            as={ExternalLink}
            size="small"
            variant="contained"
          >
            Sign Up
          </SignUpButton>
        </Fragment>
      )}
      {userInIndividualPlan && (
        <PopoverTrigger
          label={
            <div>
              {/* <i className="fa fa-circle-exclamation" /> */}
              Upgrade
            </div>
          }
        >
          <div
            style={{
              width: '100%',
              padding: 'var(--padding-md)',
              color: 'var(--color-font)',
            }}
          >
            <h3
              style={{
                margin: 0,
              }}
            >
              Individual Plan
            </h3>
            <p
              style={{
                margin: 0,
                paddingTop: 'var(--padding-md)',
                paddingBottom: 'var(--padding-md)',
              }}
            >
              Upgrade to get access to:
            </p>
            <ul
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--padding-sm)',
              }}
            >
              <li>
                <i
                  style={{
                    color: 'var(--color-success)',
                  }}
                  className="fa fa-check"
                />{' '}
                Collaboration features
              </li>
              <li>
                <i
                  style={{
                    color: 'var(--color-success)',
                  }}
                  className="fa fa-check"
                />{' '}
                Organization with up to 50 members
              </li>
            </ul>
            <div
              style={{
                paddingTop: 'var(--padding-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--padding-md)',
              }}
            >
              <ButtonWithPress
                variant='contained'
                bg="surprise"
                onPress={() =>
                  clickLink('https://app.insomnia.rest/app/subscriptions')
                }
              >
                Upgrade
              </ButtonWithPress>
              <span>or</span>
              <ExternalLink
                href="https://app.insomnia.rest/app/subscriptions"
              >
                Manage Billing
              </ExternalLink>
            </div>
          </div>
        </PopoverTrigger>
      )}
      {userInTrialWithoutCreditCard && (
        <PopoverTrigger
          label={
            <div>
              <i className="fa fa-circle-exclamation" /> Upgrade
            </div>
          }
        >
          <div
            style={{
              width: '100%',
              padding: 'var(--padding-md)',
              color: 'var(--color-font)',
            }}
          >
            <h3
              style={{
                margin: 0,
              }}
            >
              Individual Plan
            </h3>
            <p
              style={{
                margin: 0,
                paddingTop: 'var(--padding-md)',
              }}
            >
              Your free trial is expiring in {differenceInDays(new Date(user?.trialEnd), new Date())} days.
            </p>
            <div
              style={{
                paddingTop: 'var(--padding-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--padding-md)',
              }}
            >
              <ButtonWithPress
                variant='contained'
                bg="surprise"
                onPress={() =>
                  clickLink('https://app.insomnia.rest/app/subscriptions')
                }
              >
                Complete subscription
              </ButtonWithPress>
              <span>or</span>
              <ExternalLink
                href="https://app.insomnia.rest/app/subscriptions"
              >
                Change plan
              </ExternalLink>
            </div>
          </div>
        </PopoverTrigger>
      )}
    </Toolbar>
  );
};

const ButtonWithPress = (
  props: ButtonProps &
    AriaButtonProps & { buttonRef: RefObject<HTMLButtonElement> }
) => {
  const ref = props.buttonRef;
  const { buttonProps } = useButton(props, ref);

  return <Button {...buttonProps} {...props} ref={ref} />;
};

const Popover = ({ children, state, offset = 8, ...props }) => {
  const popoverRef = React.useRef(null);
  const { popoverProps } = usePopover(
    {
      ...props,
      offset,
      popoverRef,
    },
    state
  );

  return (
    <Overlay>
      <div className="underlay" />
      <div
        {...popoverProps}
        ref={popoverRef}
        style={{
          ...popoverProps.style,
          maxWidth: '400px',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--hl-sm)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <DismissButton onDismiss={state.close} />
        {children}
        <DismissButton onDismiss={state.close} />
      </div>
    </Overlay>
  );
};

const PopoverTrigger = ({ label, children, ...props }) => {
  const ref = useRef(null);
  const state = useOverlayTriggerState(props);
  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: 'dialog' },
    state,
    ref
  );

  return (
    <>
      <ButtonWithPress
        variant="contained"
        bg="surprise"
        size="small"
        {...triggerProps}
        buttonRef={ref}
      >
        {label}
      </ButtonWithPress>
      {state.isOpen && (
        <Popover {...props} triggerRef={ref} state={state}>
          {React.cloneElement(children, overlayProps)}
        </Popover>
      )}
    </>
  );
};
