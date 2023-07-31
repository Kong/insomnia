import classNames from 'classnames';
import React, { FC, Fragment, ReactNode } from 'react';
import styled from 'styled-components';

import * as session from '../../account/session';
import { GitHubStarsButton } from './github-stars-button';
import { InsomniaAILogo } from './insomnia-icon';
const LogoWrapper = styled.div({
  display: 'flex',
  justifyContent: 'center',
});

export interface AppHeaderProps {
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
  gridArea: 'Header',
  borderBottom: '1px solid var(--hl-md)',
  display: 'grid',
  padding: 'var(--padding-xs) 0',
  gridTemplateColumns: '1fr 1fr 1fr',
  gridTemplateRows: '1fr',
  gridTemplateAreas: "'header_left header_center header_right'",
  '.header_left': {
    gridArea: 'header_left',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--padding-sm)',
  },
  '.header_center': {
    gridArea: 'header_center',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  gridCenter,
  gridRight,
}) => {
  return (
    <Header
      gridLeft={(
        <Fragment>
          <LogoWrapper>
            <InsomniaAILogo />
          </LogoWrapper>
          {!session.isLoggedIn() ? <GitHubStarsButton /> : null}
        </Fragment>
      )}
      gridCenter={gridCenter}
      gridRight={gridRight}
    />
  );
};
