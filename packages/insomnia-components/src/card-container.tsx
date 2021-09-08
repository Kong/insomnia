import React, { PureComponent } from 'react';
import styled from 'styled-components';

const Cards = styled.div`
  display: flex;
  flex-wrap: wrap;
  padding-top: var(--padding-md);
`;

export class CardContainer extends PureComponent {
  render() {
    return <Cards {...this.props} />;
  }
}
