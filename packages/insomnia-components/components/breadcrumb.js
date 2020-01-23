// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  crumbs: Array<Object>,
|};

const StyledBreadcrumb: React.ComponentType<{}> = styled.ul`
    display: flex;
    flex: 1;
    margin-right: auto;
    align-items: center;
    font-size: var(--font-size-md);
    font-weight: 600;
    color: var(--color-font);
    
    a,
    a::before,
    li > ::before {
        color: var(--color-font);
        font-weight:400 !important;
    }

    li {
        
        a {
            cursor: pointer;
        }

        &::before {
            margin: 0 var(--padding-xs);
            content: "/";
        }

        &:first-child::before {
            content: "";
        }

    }
`;

class Breadcrumb extends React.PureComponent<Props> {
  render() {
    const { crumbs } = this.props;
    return (
      <StyledBreadcrumb>
        {crumbs.map((crumb, i, arr) => {
          if (arr.length - 1 === i) {
            return <li key={crumb}>{crumb}</li>;
          } else {
            return (
              <li key={crumb}>
                <a>{crumb}</a>
              </li>
            );
          }
        })}
      </StyledBreadcrumb>
    );
  }
}

export default Breadcrumb;
