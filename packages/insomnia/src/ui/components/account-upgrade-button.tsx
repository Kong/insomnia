import type { AriaPopoverProps } from '@react-aria/overlays';
import { Overlay, usePopover } from '@react-aria/overlays';
import { differenceInDays } from 'date-fns/esm';
import React, { PropsWithChildren, RefObject, useRef } from 'react';
import {
  AriaButtonProps,
  DismissButton,
  useButton,
  useOverlayTrigger,
} from 'react-aria';
import {
  OverlayTriggerProps,
  OverlayTriggerState,
  useOverlayTriggerState,
} from 'react-stately';
import styled from 'styled-components';

import { SessionData } from '../../account/session';
import { getAppWebsiteBaseURL } from '../../common/constants';
import { clickLink } from '../../common/electron-helpers';
import { Link as ExternalLink } from './base/link';
import { Button, ButtonProps } from './themed-button';

const WebsiteURL = getAppWebsiteBaseURL();

const ButtonWithPress = (
  props: ButtonProps &
    AriaButtonProps & { buttonRef?: RefObject<HTMLButtonElement> }
) => {
  const ref = useRef(null);
  const buttonRef = props.buttonRef || ref;
  const { buttonProps } = useButton(props, buttonRef);
  const { onPress, ...rest } = props;

  return <Button {...buttonProps} {...rest} ref={buttonRef} />;
};

const PopoverContent = styled.div({
  maxWidth: '400px',
  backgroundColor: 'var(--color-bg)',
  border: '1px solid var(--hl-sm)',
  borderRadius: 'var(--radius-sm)',
  boxSizing: 'border-box',
});

const Popover = ({
  children,
  state,
  offset = 8,
  ...props
}: PropsWithChildren<
  Omit<AriaPopoverProps, 'popoverRef'> & { state: OverlayTriggerState }
>) => {
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
      <PopoverContent
        {...popoverProps}
        ref={popoverRef}
        style={popoverProps.style}
      >
        <DismissButton onDismiss={state.close} />
        {children}
        <DismissButton onDismiss={state.close} />
      </PopoverContent>
    </Overlay>
  );
};

type PopoverTriggerProps = OverlayTriggerProps & {
  label: React.ReactNode;
  children: React.ReactElement;
};

const PopoverTrigger = ({ label, children, ...props }: PopoverTriggerProps) => {
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

interface Plan {
  id: string;
  name: string;
  features: string[];
  comingSoonFeatures: string[];
}

const plans: Record<string, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    features: ['All core tooling and collaboration for up to one cloud project.'],
    comingSoonFeatures: [],
  },
  individual: {
    id: 'individual',
    name: 'Individual',
    features: [
      'Unlimited cloud projects',
      'End-to-end encryption across individual projects',
    ],
    comingSoonFeatures: ['Cloud backup for 7 days'],
  },
  team: {
    id: 'team',
    name: 'Team',
    features: [
      'Organizations up to 50 seats',
      'End-to-end encryption across organizations',
      'User management',
    ],
    comingSoonFeatures: ['Cloud backup for 14 days'],
  },
  enterprise: {
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
};

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

const PlanViewContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--padding-md)',
  boxSizing: 'border-box',
});

const Header = styled.h3({
  margin: 0,
});

const List = styled.ul({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--padding-xs)',
});

const ListItem = styled.li({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-xs)',
  color: 'var(--hl)',
  overflow: 'hidden',
  wordBreak: 'break-word',
  padding: 'var(--padding-xs)',
});

const PlanView = (props: { upgradePlan: Plan; currentPlan: Plan }) => {
  const { upgradePlan, currentPlan } = props;

  return (
    <PlanViewContainer>
      <Header>Upgrade to {upgradePlan.name} Plan</Header>
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
      <List>
        {upgradePlan.features.map(feature => (
          <ListItem key={feature}>
            <Checkmark color="var(--color-surprise)" />
            {feature}
          </ListItem>
        ))}
      </List>
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
      <List>
        {upgradePlan.comingSoonFeatures.map(feature => (
          <ListItem
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
            />{' '}
            {feature}
          </ListItem>
        ))}
      </List>
    </PlanViewContainer>
  );
};

function getUserPlan(user: Partial<SessionData>): Plan {
  const planName = user.planName?.toLowerCase() || '';
  if (planName.includes('teams')) {
    return plans.team;
  }

  if (planName.includes('enterprise')) {
    return plans.enterprise;
  }

  if (planName.includes('individual')) {
    return plans.individual;
  }

  return plans.free;
}

function getUpgradePlan(currentPlan: Plan): Plan | null {
  if (currentPlan.id === plans.enterprise.id) {
    return null;
  }

  if (currentPlan.id === plans.team.id) {
    return plans.enterprise;
  }

  if (currentPlan.id === plans.individual.id) {
    return plans.team;
  }

  return plans.individual;
}

export const UpgradeAccountButton = ({ user }: { user: Partial<SessionData> }) => {
  const userInTrialWithoutCreditCard =
    user.isTrialing && user.isPaymentRequired;

  const currentPlan = getUserPlan(user);
  const upgradePlan = getUpgradePlan(currentPlan);

  const trialDaysLeft = user?.trialEnd
    ? differenceInDays(new Date(user?.trialEnd), new Date())
    : null;

  if (userInTrialWithoutCreditCard) {
    return (
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
          <Header>Individual Plan</Header>
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
                clickLink(
                  `${WebsiteURL}/app/subscribe?intent=complete_subscription`
                )
              }
            >
              Complete subscription
            </ButtonWithPress>
            <span>or</span>
            <ExternalLink href={`${WebsiteURL}/app/subscribe?intent=change_plan`}>
              Change plan
            </ExternalLink>
          </div>
        </div>
      </PopoverTrigger>
    );
  }

  return upgradePlan ? (
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
          <PlanView upgradePlan={upgradePlan} currentPlan={currentPlan} />
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
                clickLink(
                  upgradePlan.id === 'enterprise' ? 'https://insomnia.rest/pricing/contact?intent=upgrade' : `${WebsiteURL}/app/subscribe?intent=upgrade`
                )
              }
            >
              Upgrade
            </ButtonWithPress>
            <span>or</span>
            <ExternalLink href={`${WebsiteURL}/app/subscribe?intent=manage_billing`}>
              Manage Billing
            </ExternalLink>
          </div>
        </div>
      </div>
    </PopoverTrigger>
  ) : null;
};
