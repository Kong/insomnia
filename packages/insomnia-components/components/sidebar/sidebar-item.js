// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  children: React.Node,
  gridLayout?: boolean,
};

const StyledBlockItem: React.ComponentType<{}> = styled.div`
  padding: 0 var(--padding-md) var(--padding-sm) 0;
  margin: 0;
  display: block;
  font-size: var(--font-size-md);
  line-height: var(--font-size-sm);
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
    margin: 0 0 0 var(--padding-sm);
  }
  div {
    display: inline;
    margin: 0;
  }
  div:nth-child(1) {
    padding-left: var(--padding-sm);
  }
  div.tooltip {
    padding: 0;
  }
`;

const StyledGridItem: React.ComponentType<{}> = styled.li`
  padding: 0 0 0 var(--padding-sm);
  margin: 0;
  display: grid;
  grid-template-columns: 0.25fr 5fr;
  column-gap: var(--padding-sm);
  grid-template-rows: 1fr;
  align-items: start;
  white-space: nowrap;
  font-size: var(--font-size-md);
  line-height: var(--font-size-sm);
  span {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    padding: 4px var(--padding-sm) var(--padding-xs) 0px;
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

const SidebarItem = ({ children, gridLayout }: Props) => {
  if (gridLayout) {
    return <StyledGridItem>{children}</StyledGridItem>;
  } else {
    return <StyledBlockItem>{children}</StyledBlockItem>;
  }
};

export default SidebarItem;
