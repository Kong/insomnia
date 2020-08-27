// @flow
import * as React from 'react';
import styled from 'styled-components';
import SvgIcon from '../svg-icon';

type Props = {|
  timeMs: String,
|};

const StyledTimestamp: React.ComponentType<{}> = styled.div`
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

const UnitTestResultTimestamp = ({ timeMs }: Props) => {
  return (
    <StyledTimestamp>
      {' '}
      <SvgIcon icon="clock" />
      <div>{timeMs} ms</div>
    </StyledTimestamp>
  );
};

export default UnitTestResultTimestamp;
