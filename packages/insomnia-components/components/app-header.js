// @flow
import * as React from 'react';
import GravatarImg from './gravatar-img';
import styled from 'styled-components';
import Breadcrumb from './breadcrumb';

type Props = {
  className: string,
  onBreadcrumb: (index: number) => any,
  breadcrumbs: Array<String>,
  menu?: React.Node,
};

const StyledAppHeader: React.ComponentType<{}> = styled.div`
  display:flex;
  justify-content: space-between;
  border-bottom:1px solid var(--hl-md);;
  padding: var(--padding-sm) var(--padding-md);
`;

const StyledMenu: React.ComponentType<{}> = styled.div`
    color: var(--hl);
    display:flex;
    align-items: center;
    & > * {
      margin-left: var(--padding-xs);
    }
`;

class AppHeader extends React.PureComponent<Props> {
  render() {
    const { className, menu, breadcrumbs, onBreadcrumb } = this.props;
    return (
      <StyledAppHeader className={className}>
        <GravatarImg
          className="gravatar"
          rounded
          email="support@insomnia.rest"
          size={24}
        />
        <Breadcrumb crumbs={breadcrumbs} onClick={onBreadcrumb} />
        {menu && <StyledMenu>{menu}</StyledMenu>}
      </StyledAppHeader>
    );
  }
}

export default AppHeader;
