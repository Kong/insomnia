// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  children?: React.Node,
  bordered?: boolean,
|};

const StyledListGroup: React.ComponentType<{}> = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;

  ${({ bordered }) =>
    bordered &&
    `border: 1px solid var(--hl-sm);
     border-radius: var(--radius-sm);
     li:last-of-type {border-bottom:none;};
    `}
`;

const ListGroup = ({ children, bordered }: Props) => {
  return <StyledListGroup bordered={bordered}>{children}</StyledListGroup>;
};

export default ListGroup;
