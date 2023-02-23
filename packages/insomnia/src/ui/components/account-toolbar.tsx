import { Overlay, usePopover } from '@react-aria/overlays';
import { differenceInDays } from 'date-fns/esm';
import React, { Fragment, RefObject, useRef } from 'react';
import { AriaButtonProps, DismissButton, useButton } from 'react-aria';
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

interface Plan {
  id: string;
  name: string;
  features: string[];
  comingSoonFeatures: string[];
}

const plans: Plan[] = [
  {
    id: 'individual',
    name: 'Individual',
    features: [
      'Unlimited cloud projects',
      'End-to-end encryption across individual projects',
    ],
    comingSoonFeatures: ['Cloud backup for 7 days'],
  },
  {
    id: 'team',
    name: 'Team',
    features: [
      'Organizations up to 50 seats',
      'End-to-end encryption across organizations',
      'User management',
    ],
    comingSoonFeatures: ['Cloud backup for 14 days'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    features: [
      'Unlimited seats',
      '24/5/365 support from Kong Inc.',
      'Custom payment options',
    ],
    comingSoonFeatures: [
      'Enterprise SSO',
      'Enterprise RBAC',
      'Cloud backup for 1 year',
    ],
  },
];

// Enterprise - No upgrade
// Free - Upgrade to Individual
// Individual - Upgrade to Team...

const Checkmark = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      data-prefix="far"
      data-icon="circle-check"
      className="svg-inline--fa fa-circle-check fa-sm"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="1em"
      height="1em"
      {...props}
    >
      <path
        fill="currentColor"
        d="M243.8 339.8c-10.9 10.9-28.7 10.9-39.6 0l-64-64c-10.9-10.9-10.9-28.7 0-39.6 10.9-10.9 28.7-10.9 39.6 0l44.2 44.2 108.2-108.2c10.9-10.9 28.7-10.9 39.6 0 10.9 10.9 10.9 28.7 0 39.6l-128 128zM512 256c0 141.4-114.6 256-256 256S0 397.4 0 256 114.6 0 256 0s256 114.6 256 256zM256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48z"
      />
    </svg>
  );
};

const PlanView = (props: { plan: Plan; currentPlan: Plan }) => {
  const { plan, currentPlan } = props;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--padding-sm)',
        boxSizing: 'border-box',
      }}
    >
      <h3
        style={{
          margin: 0,
        }}
      >
        Upgrade to {plan.name} Plan
      </h3>
      <p
        style={{
          margin: 0,
          paddingTop: 'var(--padding-md)',
          paddingBottom: 'var(--padding-xs)',
          fontWeight: 'bold',
          color: 'var(--hl)',
        }}
      >
        Everything in {currentPlan.name} plus:
      </p>
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--padding-xs)',
        }}
      >
        {plan.features.map(feature => (
          <li
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-xs)',
              color: 'var(--hl)',
              overflow: 'hidden',
              wordBreak: 'break-word',
              padding: 'var(--padding-xs)',
            }}
            key={feature}
          >
            <Checkmark color="var(--color-surprise)" />
            {feature}
          </li>
        ))}
      </ul>
      <div
        style={{
          marginTop: 'var(--padding-md)',
        }}
      >
        <p
          style={{
            margin: 0,
            padding: 'var(--padding-xs)',
            textTransform: 'uppercase',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--hl-sm)',
            fontSize: 'var(--font-size-xs)',
            display: 'inline-block',
            textAlign: 'center',
            alignItems: 'center',
            verticalAlign: 'middle',
          }}
        >
          Coming soon
        </p>
      </div>
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--padding-sm)',
        }}
      >
        {plan.comingSoonFeatures.map(feature => (
          <li
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: 'var(--padding-xxs)',
              gap: 'var(--padding-xs)',
              color: 'var(--hl-xl)',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
            key={feature}
          >
            <i
              style={{
                fontSize: '6px',
              }}
              className="fa fa-circle fa-xs"
            /> {feature}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const AccountToolbar = () => {
  const isLoggedIn = session.isLoggedIn();
  const user = session.getSession();
  console.log('user: ', user);
  const userInTrialWithoutCreditCard = true; // user?.isTrialing && user?.isPaymentRequired;
  const userInIndividualPlan = false; // user?.planId === '';
  const trialDaysLeft = user?.trialEnd
    ? differenceInDays(new Date(user?.trialEnd), new Date())
    : null;

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
      {
        <PopoverTrigger label={<div>Upgrade</div>}>
          <div
            style={{
              width: '100%',
              padding: 'var(--padding-md)',
              color: 'var(--color-font)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                paddingTop: 'var(--padding-sm)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--padding-md)',
              }}
            >
              <PlanView plan={plans[1]} currentPlan={plans[0]} />
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--padding-md)',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100%',
                }}
              >
                <ButtonWithPress
                  variant="contained"
                  bg="surprise"
                  style={{
                    fontWeight: 'bold',
                  }}
                  onPress={() =>
                    clickLink('https://app.insomnia.rest/app/subscribe')
                  }
                >
                  Upgrade
                </ButtonWithPress>
                <span>or</span>
                <ExternalLink href="https://app.insomnia.rest/app/subscribe">
                  Manage Billing
                </ExternalLink>
              </div>
            </div>
          </div>
        </PopoverTrigger>
      }
      {false && (
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
              {trialDaysLeft && trialDaysLeft > 1
                ? `Your free trial is expiring in ${trialDaysLeft} days.`
                : 'Your free trial has expired.'}
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
                variant="contained"
                bg="surprise"
                onPress={() =>
                  clickLink('https://app.insomnia.rest/app/subscribe')
                }
              >
                Complete subscription
              </ButtonWithPress>
              <span>or</span>
              <ExternalLink href="https://app.insomnia.rest/app/subscribe">
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
          boxSizing: 'border-box',
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
