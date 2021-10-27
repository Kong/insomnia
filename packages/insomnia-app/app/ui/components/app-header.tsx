import { Breadcrumb, BreadcrumbProps, Header } from 'insomnia-components';
import React, { FC, Fragment, ReactNode } from 'react';

import coreLogo from '../images/insomnia-core-logo.png';
import SettingsButton from './buttons/settings-button';
import { AccountDropdown } from './dropdowns/account-dropdown';

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
        <Fragment>
          {gridRight}
          <SettingsButton className="margin-left" />
          <AccountDropdown className="margin-left" />
        </Fragment>
      )}
    />
  );
};
