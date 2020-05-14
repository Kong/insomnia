// @flow
import * as React from 'react';
import styled from 'styled-components';

const Cards: React.ComponentType<{}> = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding-top: var(--padding-md);
`;

class CardContainer extends React.PureComponent<{}> {
  render() {
    return <Cards {...this.props} />;
  }
}

export default CardContainer;
