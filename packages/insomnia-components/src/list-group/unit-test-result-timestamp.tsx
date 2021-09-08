import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

import { SvgIcon } from '../svg-icon';

export interface UnitTestResultTimestampProps {
  timeMs: String;
}

const StyledTimestamp = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--hl-xl);

  svg {
    fill: var(--hl-xl);
    margin-right: var(--padding-xxs);
  }
`;

export const UnitTestResultTimestamp: FunctionComponent<UnitTestResultTimestampProps> = ({ timeMs }) => {
  return (
    <StyledTimestamp>
      {' '}
      <SvgIcon icon="clock" />
      <div>{timeMs} ms</div>
    </StyledTimestamp>
  );
};
