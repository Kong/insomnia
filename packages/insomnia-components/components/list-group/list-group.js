// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  children?: React.Node,
|};

const StyledListGroup: React.ComponentType<{}> = styled.ul`
  list-style-type: none;
  margin: 0;
  padding: 0;
`;

const ListGroup = ({ children }: Props) => {
  return <StyledListGroup>{children}</StyledListGroup>;
};

export default ListGroup;
