import React, { FC, ReactNode } from 'react';
import styled from 'styled-components';

interface CrumbProps {
  id: string;
  node: ReactNode;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}

export interface BreadcrumbProps {
  crumbs: CrumbProps[];
  className?: string;
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

const Crumb: FC<CrumbProps> = ({ id, node, onClick }) => <li key={id}>
  {onClick ? <a href="#" onClick={onClick}>{node}</a> : node}
</li>;

export const Breadcrumb: FC<BreadcrumbProps> = ({ crumbs, className }) => (
  <StyledBreadcrumb className={className}>
    {crumbs.map(Crumb)}
  </StyledBreadcrumb>
);
