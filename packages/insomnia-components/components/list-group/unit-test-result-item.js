// @flow
import * as React from 'react';
import styled from 'styled-components';
import ListGroupItem from './list-group-item';
import UnitTestResultTimeStamp from './unit-test-result-timestamp';
import UnitTestResultBadge from './unit-test-result-badge';

type Props = {|
  item: Object,
|};

const StyledResultListItem: React.ComponentType<{}> = styled(ListGroupItem)`
  > div:first-of-type {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    > *:not(:first-child) {
      margin: var(--padding-xs) 0 var(--padding-xs) var(--padding-sm);
    }
  }

  code {
    background-color: var(--hl-xs);
    padding: var(--padding-sm) var(--padding-md) var(--padding-sm) var(--padding-md);
    color: var(--color-danger);
    display: block;
    margin: var(--padding-sm) 0 0 0;
  }

  p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-grow: 1;
  }
`;

const UnitTestResultItem = ({ item }: Props) => {
  return (
    <StyledResultListItem>
      <div>
        <UnitTestResultBadge failed={!!item.err.message} />
        <p>{item.title}</p>
        <UnitTestResultTimeStamp timeMs={item.duration} />
      </div>
      {item.err.message && <code>{item.err.message}</code>}
    </StyledResultListItem>
  );
};

export default UnitTestResultItem;
