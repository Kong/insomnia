import { CircleButton, SvgIcon, Tooltip } from 'insomnia-components';
import React, { Fragment, FunctionComponent } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import * as session from '../../../account/session';
import { selectSettings } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
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

export const AccountDropdown: FunctionComponent<Props> = ({ className }) => {
  const { disablePaidFeatureAds } = useSelector(selectSettings);
  return (
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
          <Fragment>
            <DropdownItem key="login" onClick={showLoginModal}>
              <StyledIconContainer>
                <i className="fa fa-sign-in" />
              </StyledIconContainer>
              Log In
            </DropdownItem>
            {!disablePaidFeatureAds && (
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
          </Fragment>
        )}
      </Dropdown>
    </div>
  );
};
