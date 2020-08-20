// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  className?: string,
  children?: React.Node,
|};

const StyledListGroup: React.ComponentType<{}> = styled.ul`
  list-style-type: none;
  margin: 0px;
  padding: 0px var(--padding-xs) 0px 0px;
`;

class ListGroup extends React.PureComponent<Props> {
  render() {
    const { children } = this.props;
    return <StyledListGroup>{children}</StyledListGroup>;
  }
}

export default ListGroup;
