import React, { FC, memo } from 'react';
import styled, { css } from 'styled-components';

const StyledDivider = styled.div<{ hasName: boolean }>`
  border-bottom: 1px solid var(--hl-sm);
  overflow: visible !important;
  height: 0;
  margin: var(--padding-md) var(--padding-md) var(--padding-md) var(--padding-md);
  ${({ hasName }) =>
    !hasName &&
    css`
      margin: var(--padding-xs) 0;
    `}
`;

const StyledLabel = styled.span`
  position: relative;
  left: calc(-1 * var(--padding-sm));
  top: -0.7rem;
  color: var(--hl);
  padding-right: 1em;
  background: var(--color-bg);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  font-family: var(--font-default);
`;

export const DropdownDivider: FC = memo(({ children }) => (
  <StyledDivider hasName={!!children}>
    {children && <StyledLabel>{children}</StyledLabel>}
  </StyledDivider>
));

DropdownDivider.displayName = 'DropdownDivider';
