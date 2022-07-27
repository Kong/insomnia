import { Breadcrumb, BreadcrumbProps, Header as _Header } from 'insomnia-components';
import React, { FC, Fragment, ReactNode } from 'react';
import styled from 'styled-components';

import coreLogo from '../images/insomnia-logo.svg';
import { SettingsButton } from './buttons/settings-button';
import { AccountDropdownButton } from './dropdowns/account-dropdown/account-dropdown';
import { GitHubStarsButton } from './github-stars-button';

const LogoWraper = styled.div({
  display: 'flex',
});

const Header =  styled(_Header)({
  '&&': {
    whiteSpace: 'nowrap',
  },
});

const RightWrapper = styled.div({
  transformOrigin: 'right',
  transform: 'scale(0.85)',
  display: 'flex',
  justifySelf: 'flex-end',
  alignItems: 'center',
  '& .tooltip': {
    display: 'flex',
    alignItems: 'center',
  },
});

export interface AppHeaderProps {
  breadcrumbProps: BreadcrumbProps;
  gridCenter?: ReactNode;
  gridRight?: ReactNode;
}

export const AppHeader: FC<AppHeaderProps> = ({
  breadcrumbProps,
  gridCenter,
  gridRight,
}) => {
  return (
    <Header
      gridLeft={(
        <Fragment>
          <LogoWraper>
            <img style={{ zIndex: 1 }} src={coreLogo} alt="Insomnia" width="28" height="28" />
            <GitHubStarsButton />
          </LogoWraper>
          <Breadcrumb {...breadcrumbProps} />
        </Fragment>
      )}
      gridCenter={gridCenter}
      gridRight={(
        <RightWrapper>
          {gridRight}
          <SettingsButton />
          <AccountDropdownButton />
        </RightWrapper>
      )}
    />
  );
};
