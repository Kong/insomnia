// @flow
import * as React from 'react';
import styled from 'styled-components';
import SvgIcon from '../svg-icon';
import ListGroupItem from './list-group-item';

type Props = {|
  children?: React.Node,
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

const UnitTestResultItem = ({ children }: Props) => {
  return <StyledResultListItem>{children}</StyledResultListItem>;
};

export { UnitTestResultItem, StyledFailedBadge, StyledPassedBadge, StyledTimestamp, SvgIcon };
