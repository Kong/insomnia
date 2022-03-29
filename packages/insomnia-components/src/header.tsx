import classNames from 'classnames';
import React, { FC, memo, ReactNode } from 'react';
import styled from 'styled-components';

export interface HeaderProps {
  className?: string;
  gridLeft?: ReactNode;
  gridCenter?: ReactNode;
  gridRight?: ReactNode;
}

const StyledHeader = styled.div`
  border-bottom: 1px solid var(--hl-md);
  padding: var(--padding-xxs) var(--padding-sm);
  display: grid;
  grid-template-columns: 2fr 1.5fr 2fr;
  grid-template-rows: 1fr;
  grid-template-areas: 'header_left header_center header_right';
  .header_left {
    grid-area: header_left;
    text-align: left;
    display: flex;
    align-items: center;
  }
  .header_center {
    grid-area: header_center;
    text-align: center;
    display: flex;
    align-items: center;
  }
  .header_right {
    grid-area: header_right;
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
`;

export const Header: FC<HeaderProps> = memo(({ className, gridLeft, gridCenter, gridRight }) => (
  <StyledHeader className={classNames('app-header theme--app-header', className)}>
    <div className="header_left">{gridLeft}</div>
    <div className="header_center">{gridCenter}</div>
    <div className="header_right">{gridRight}</div>
  </StyledHeader>
));

Header.displayName = 'Header';
