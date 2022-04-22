import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

export interface UnitTestResultBadgeProps {
  failed?: boolean;
}

const StyledBadge = styled.span`
  padding: var(--padding-xs) var(--padding-sm);
  border: 1px solid var(--color-success);
  background-color: var(--color-bg);
  color: var(--color-success);
  font-weight: var(--font-weight-bold);
  border-radius: var(--radius-sm);
  flex-basis: 3.5em;
  flex-shrink: 0;
  text-align: center;
  text-transform: capitalize;
`;

const StyledFailedBadge = styled(StyledBadge)`
  && {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }
`;

const StyledPassedBadge = styled(StyledBadge)`
  && {
    border-color: var(--color-success);
    color: var(--color-success);
  }
`;

export const UnitTestResultBadge: FunctionComponent<UnitTestResultBadgeProps> = ({ failed }) => failed ? (
  <StyledFailedBadge>Failed</StyledFailedBadge>
) : (
  <StyledPassedBadge>Passed</StyledPassedBadge>
);
