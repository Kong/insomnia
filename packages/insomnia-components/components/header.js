// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  className?: string,
  gridLeft?: React.Node,
  gridCenter?: React.Node,
  gridRight?: React.Node,
|};

const StyledHeader: React.ComponentType<{}> = styled.div`
  border-bottom: 1px solid var(--hl-md);
  padding: var(--padding-md);
  display: grid;
  grid-template-columns: 2fr 1.5fr 2fr;
  grid-template-rows: 1fr;
  grid-template-areas: 'header_left header_center header_right';
  .header_left {
    grid-area: header_left;
    text-align: left;
    display: flex;
    align-items: center;
  }
  .header_center {
    grid-area: header_center;
    text-align: center;
    display: flex;
    align-items: center;
  }
  .header_right {
    grid-area: header_right;
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
`;

class Header extends React.PureComponent<Props> {
  render() {
    const { className, gridLeft, gridCenter, gridRight } = this.props;
    return (
      <StyledHeader className={className}>
        <div className="header_left">{gridLeft}</div>
        <div className="header_center">{gridCenter}</div>
        <div className="header_right">{gridRight}</div>
      </StyledHeader>
    );
  }
}

export default Header;
