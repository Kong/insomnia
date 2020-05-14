// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  crumbs: Array<Object>,
  onClick: (index: number) => any,
|};

const StyledBreadcrumb: React.ComponentType<{}> = styled.ul`
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-font);
  grid-area: breadcrumbs;
  display: flex;
  align-items: center;
  justify-content: center;

  a,
  a::before,
  li > ::before {
    color: var(--color-font);
    font-weight: 400 !important;
  }

  li {
    a {
      cursor: pointer;
    }

    &::before {
      margin: 0 var(--padding-xs);
      content: '/';
    }

    &:first-child::before {
      content: '';
    }
  }
`;

class Breadcrumb extends React.PureComponent<Props> {
  _handleClick(index: number, e: SyntheticEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const { onClick } = this.props;
    if (typeof onClick === 'function') {
      onClick(index);
    }
  }

  render() {
    const { crumbs, onClick } = this.props;
    return (
      <StyledBreadcrumb>
        {crumbs.map((crumb, i, arr) => {
          if (arr.length - 1 === i) {
            return <li key={crumb}>{crumb}</li>;
          } else {
            return (
              <li key={crumb}>
                <a href="#" onClick={onClick}>
                  {crumb}
                </a>
              </li>
            );
          }
        })}
      </StyledBreadcrumb>
    );
  }
}

export default Breadcrumb;
