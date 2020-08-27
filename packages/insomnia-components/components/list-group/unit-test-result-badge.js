// @flow
import * as React from 'react';
import styled from 'styled-components';

type Props = {|
  failed?: boolean,
|};

const StyledBadge: React.ComponentType<{}> = styled.span`
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

const StyledFailedBadge: React.ComponentType<{}> = styled(StyledBadge)`
  border-color: var(--color-danger);
  color: var(--color-danger);
`;

const StyledPassedBadge: React.ComponentType<{}> = styled(StyledBadge)`
  border-color: var(--color-success);
  color: var(--color-success);
`;

const UnitTestResultBadge = ({ failed }: Props) => {
  if (failed) {
    return <StyledFailedBadge>Failed</StyledFailedBadge>;
  }
  return <StyledPassedBadge>Passed</StyledPassedBadge>;
};

export default UnitTestResultBadge;
