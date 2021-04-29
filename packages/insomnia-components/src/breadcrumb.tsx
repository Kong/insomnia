import React, { PureComponent } from 'react';
import styled from 'styled-components';

interface Props {
  crumbs: string[];
  className: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

const StyledBreadcrumb = styled.ul`
  font-size: var(--font-size-lg);
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
  }

  li {
    display: flex;
    flex-direction: row;

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

export class Breadcrumb extends PureComponent<Props> {
  render() {
    const { className, crumbs, onClick } = this.props;
    return (
      <StyledBreadcrumb className={className}>
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
