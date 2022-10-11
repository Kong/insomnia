import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

export interface SidebarItemProps {
  children: ReactNode;
  gridLayout?: boolean;
  onClick?: () => void;
}

const StyledBlockItem = styled.div`
  padding: var(--padding-xs) var(--padding-md) var(--padding-xs) 0;
  margin: 0;
  display: flex;
  align-items: center;
  font-size: var(--font-size-md);
  line-height: var(--font-size-md);
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }
  &:last-child {
    margin-bottom: var(--padding-md);
  }
  span {
    margin: 0 0 0 var(--padding-xs);
  }
  div {
    display: inline;
    margin: 0;
  }
  div:nth-child(1) {
    padding-left: var(--padding-xs);
  }
  div.tooltip {
    padding: 0;
  }
`;

const StyledGridItem = styled.li`
  padding: 0 0 0 var(--padding-sm);
  margin: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
  font-size: var(--font-size-md);
  line-height: var(--font-size-sm);
  &:first-child {
    margin-top: var(--padding-xxs);
  }
  span {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    padding: 4px var(--padding-sm) var(--padding-xs) 0px;
    margin-left: var(--padding-xs);
  }
  a {
    color: var(--hl-xl);
  }
  div:nth-child(1) {
    text-align: right;
    svg {
      padding-left: var(--padding-sm);
    }
  }
  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }
  &:last-child {
    margin-bottom: var(--padding-md);
  }
`;

export const SidebarItem: FunctionComponent<SidebarItemProps> = ({ children, gridLayout, onClick }) => {
  if (gridLayout) {
    return <StyledGridItem onClick={onClick}>{children}</StyledGridItem>;
  } else {
    return <StyledBlockItem onClick={onClick}>{children}</StyledBlockItem>;
  }
};
