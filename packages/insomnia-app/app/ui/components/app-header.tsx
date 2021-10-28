import { Breadcrumb, BreadcrumbProps, Header } from 'insomnia-components';
import React, { FC, Fragment, ReactNode } from 'react';
import styled from 'styled-components';

import coreLogo from '../images/insomnia-core-logo.png';
import { SettingsButton } from './buttons/settings-button';
import { AccountDropdownButton } from './dropdowns/account-dropdown';

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
  breadcrumbProps: { crumbs, isLoading },
  gridCenter,
  gridRight,
}) => {
  return (
    <Header
      gridLeft={(
        <Fragment>
          <img src={coreLogo} alt="Insomnia" width="24" height="24" />
          <Breadcrumb crumbs={crumbs} isLoading={isLoading}/>
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
