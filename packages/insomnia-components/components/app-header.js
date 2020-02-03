// @flow
import * as React from 'react';
import GravatarImg from './gravatar-img';
import styled from 'styled-components';
import Breadcrumb from './breadcrumb';

const StyledAppHeader: React.ComponentType<{}> = styled.div`
  display:flex;
  justify-content: space-between;
  border:1px solid var(--hl-md);;
  padding: var(--padding-sm) var(--padding-md);
`;

const StyledMenu: React.ComponentType<{}> = styled.div`
    color: var(--hl-xl);
    display:flex;
    align-items: center;
`;

class AppHeader extends React.PureComponent<{}> {
  render() {
    return (
      <StyledAppHeader>
        <GravatarImg
          className="gravatar"
          rounded
          email="support@insomnia.rest"
          size={24}
        />
        <Breadcrumb crumbs={['Documents', 'Deployment']} />
        <StyledMenu>Menu FPO</StyledMenu>
      </StyledAppHeader>
    );
  }
}

export default AppHeader;
