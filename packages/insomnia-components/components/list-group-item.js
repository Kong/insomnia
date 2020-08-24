// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  children?: React.Node,
|};

const StyledListItem: React.ComponentType<{}> = styled.li`
  border-bottom: 1px solid var(--hl-xs);
  padding: var(--padding-sm) var(--padding-sm);
`;

const ListGroupItem = ({ children }: Props) => {
  return <StyledListItem>{children}</StyledListItem>;
};

export default ListGroupItem;
