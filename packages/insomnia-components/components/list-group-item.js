// @flow
import * as React from 'react';
import styled from 'styled-components';
import SvgIcon, { IconEnum } from './svg-icon';

type Props = {|
  className?: string,
  result: string,
  errorMsg?: string,
  time: string,
  name: string,
|};

const StyledListItem: React.ComponentType<{}> = styled.li`
  padding: var(--padding-xs) var(--padding-sm) var(--padding-xs) var(--padding-xs);
  border-bottom: 1px solid var(--hl-xs);

  > div:first-of-type {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    > *:not(:first-child) {
      margin: var(--padding-xs) var(--padding-xs) var(--padding-xs) var(--padding-xs);
    }
  }

  .itemToggler {
    font-size: var(--font-size-xxs);
    color: var(--hl-md);
    margin-right: var(--padding-xxs);
    min-width: 1em;
  }

  code {
    background-color: var(--hl-xs);
    padding: var(--padding-sm) var(--padding-md) var(--padding-sm) var(--padding-md);
    color: var(--color-danger);
    display: block;
    margin: var(--padding-xxs) var(--padding-sm) var(--padding-xxs) var(--padding-md);
  }

  .timestamp {
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
  }

  p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-grow: 1;
  }
`;

// TODO: Create a collection of visual badges within our component system.
const StyledBadge: React.ComponentType<{}> = styled.span`
  padding: var(--padding-xs) var(--padding-sm);
  border: 1px solid var(--color-success);
  background-color: var(--color-bg);
  color: var(--color-success);
  font-weight: var(--font-weight-bold);
  border-radius: var(--radius-sm);
  flex-basis: 2.5em;
  flex-shrink: 0;
  text-align: center;
  text-transform: capitalize;

  &.pass {
    border-color: var(--color-success);
    color: var(--color-success);
  }
  &.fail {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }
`;

class ListGroupItem extends React.PureComponent<Props> {
  render() {
    const { errorMsg, result, name, time } = this.props;
    return (
      <StyledListItem>
        <div>
          <div className="itemToggler">
            {/* 
            TODO: Add show/hide toggle support in the future.
            errorMsg && <SvgIcon icon={IconEnum.chevronDown}></SvgIcon>}
            */}
          </div>
          <StyledBadge className={result}>{result}</StyledBadge>
          <p>{name}</p>
          <div className="timestamp">
            <SvgIcon icon={IconEnum.clock}></SvgIcon>
            <span>{time}</span>
          </div>
        </div>
        {errorMsg && <code>{errorMsg}</code>}
      </StyledListItem>
    );
  }
}

export default ListGroupItem;
