// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  children: React.Node,
};

const StyledItem: React.ComponentType<{}> = styled.li`
  padding: 0 0 0 0;
  margin: 0;
  display: grid;
  grid-template-columns: 0.2fr 0.25fr 5fr;
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
  }
  &:hover {
    background-color: var(--hl-xxs);
    cursor: default;
  }
  &:last-child {
    margin-bottom: var(--padding-md);
  }
`;

const SidebarItem = ({ children }: Props) => <StyledItem>{children}</StyledItem>;

export default SidebarItem;