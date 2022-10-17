import classNames from 'classnames';
import React, { FC, Fragment, ReactNode } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import coreLogo from '../images/insomnia-logo.svg';
import { selectIsLoggedIn } from '../redux/selectors';
import { Breadcrumb, BreadcrumbProps } from './breadcrumb';
import { SettingsButton } from './buttons/settings-button';
import { AccountDropdownButton } from './dropdowns/account-dropdown/account-dropdown';
import { GitHubStarsButton } from './github-stars-button';

const LogoWrapper = styled.div({
  display: 'flex',
});

export interface AppHeaderProps {
  breadcrumbProps: BreadcrumbProps;
  gridCenter?: ReactNode;
  gridRight?: ReactNode;
}

export interface HeaderProps {
  className?: string;
  gridLeft?: ReactNode;
  gridCenter?: ReactNode;
  gridRight?: ReactNode;
}

const StyledHeader = styled.div({
  borderBottom: '1px solid var(--hl-md)',
  padding: 'var(--padding-xxs) var(--padding-sm)',
  display: 'grid',
  gridTemplateColumns: '2fr 1.5fr 2fr',
  gridTemplateRows: '1fr',
  gridTemplateAreas: "'header_left header_center header_right'",
  '.header_left': {
    gridArea: 'header_left',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
  },
  '.header_center': {
    gridArea: 'header_center',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
  },
  '.header_right': {
    gridArea: 'header_right',
    textAlign: 'right',
    display: 'flex',
    gap: 'var(--padding-xs)',
    padding: 'var(--padding-xs)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  '&&': {
    whiteSpace: 'nowrap',
  },
});

const Header: FC<HeaderProps> = ({ className, gridLeft, gridCenter, gridRight }) => (
  <StyledHeader className={classNames('app-header theme--app-header', className)}>
    <div className="header_left">{gridLeft}</div>
    <div className="header_center">{gridCenter}</div>
    <div className="header_right">{gridRight}</div>
  </StyledHeader>
);

Header.displayName = 'Header';

export const AppHeader: FC<AppHeaderProps> = ({
  breadcrumbProps,
  gridCenter,
  gridRight,
}) => {
  const isLoggedIn = useSelector(selectIsLoggedIn);

  return (
    <Header
      gridLeft={(
        <Fragment>
          <LogoWrapper>
            <img style={{ zIndex: 1 }} src={coreLogo} alt="Insomnia" width="28" height="28" />
            { !isLoggedIn ? <GitHubStarsButton /> : null }
          </LogoWrapper>
          <Breadcrumb {...breadcrumbProps} />
        </Fragment>
      )}
      gridCenter={gridCenter}
      gridRight={
        <Fragment>
          {gridRight}
          <SettingsButton />
          <AccountDropdownButton />
        </Fragment>
      }
    />
  );
};
