// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  children: React.Node,
};

const StyledBlockItem: React.ComponentType<{}> = styled.div`
  padding: 0 var(--padding-md) var(--padding-sm) var(--padding-md);
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
    margin: 0 var(--padding-sm) 0 var(--padding-sm);
  }
  div {
    display: inline;
    margin: 0 var(--padding-sm) 0 var(--padding-sm);

    &:first-of-type {
      margin-left: var(--padding-lg);
    }
  }
`;

const SidebarBlockItem = ({ children }: Props) => <StyledBlockItem>{children}</StyledBlockItem>;

export default SidebarBlockItem;
