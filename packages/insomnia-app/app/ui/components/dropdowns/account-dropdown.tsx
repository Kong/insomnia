import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import * as session from '../../../account/session';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import Link from '../base/link';
import PromptButton from '../base/prompt-button';
import { showLoginModal } from '../modals/login-modal';

interface Props {
  className?: string;
}

const StyledIconContainer = styled.div`
  display: flex;
  align-items: center;
  padding-left: var(--padding-xs);
  padding-right: var(--padding-md);
  i {
    width: unset !important;
  }
`;

const AccountDropdown: FunctionComponent<Props> = ({ className }) => (
  <div className={className}>
    <Dropdown>
      <DropdownButton noWrap>
        <Tooltip delay={1000} position="bottom" message="Account">
          <CircleButton>
            <SvgIcon icon="user" />
          </CircleButton>
        </Tooltip>
      </DropdownButton>
      {session.isLoggedIn() ? (
        <DropdownItem
          key="login"
          stayOpenAfterClick
          buttonClass={PromptButton}
          onClick={session.logout}
        >
          <StyledIconContainer>
            <i className="fa fa-sign-out" />
          </StyledIconContainer>
          Logout
        </DropdownItem>
      ) : (
        <DropdownItem key="login" onClick={showLoginModal}>
          <StyledIconContainer>
            <i className="fa fa-sign-in" />
          </StyledIconContainer>
          Log In
        </DropdownItem>
      )}
      {!session.isLoggedIn() && (
        <DropdownItem
          key="invite"
          buttonClass={Link}
          // @ts-expect-error -- TSCONVERSION appears to be genuine
          href="https://insomnia.rest/pricing"
          button
        >
          <StyledIconContainer>
            <i className="fa fa-users" />
          </StyledIconContainer>{' '}
          Upgrade to Plus
          <i className="fa fa-star surprise fa-outline" />
        </DropdownItem>
      )}
    </Dropdown>
  </div>
);

export default AccountDropdown;
