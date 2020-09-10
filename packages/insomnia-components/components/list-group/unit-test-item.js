// @flow
import * as React from 'react';
import styled from 'styled-components';
import SvgIcon from '../svg-icon';
import Button from '../button';
import ListGroupItem from './list-group-item';

type Props = {|
  item: Object,
  children?: React.Node,
  onDeleteTest?: Function,
  onRunTest?: Function,
  testSelection?: React.Node,
  testNameEditable?: React.Node,
  testsRunning?: Object,
|};

const StyledResultListItem: React.ComponentType<{}> = styled(ListGroupItem)`
  padding: 0 var(--padding-sm);

  .form-control {
    padding: 0 var(--padding-sm);
    border: 1px solid var(--hl-md);
    border-radius: var(--radius-sm);
    margin: var(--padding-sm) var(--padding-sm) var(--padding-sm) auto;
    max-width: 18rem;
    flex: 0 0 auto;
    select {
      height: var(--line-height-xs);
      border: none !important;
      background: none !important;
      color: var(--font-color);
    }
    * {
      margin: 0px;
    }
  }

  > div:first-of-type {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    align-items: center;
  }

  svg {
    fill: var(--hl-xl);
  }

  h2 {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-normal);
    margin: 0px;
  }

  button {
    padding: 0px var(--padding-sm);
  }
`;

const UnitTestItem = ({
  item,
  children,
  onDeleteTest,
  onRunTest,
  testSelection,
  testNameEditable,
  testsRunning,
}: Props) => {
  const [collapse, toggleCollapse] = React.useState(false);
  const toggleRotation = -90;

  return (
    <StyledResultListItem>
      <div>
        <Button
          onClick={() => toggleCollapse(!collapse)}
          variant="text"
          style={!collapse ? { transform: `rotate(${toggleRotation}deg)` } : {}}>
          <SvgIcon icon="chevron-down" />
        </Button>
        <Button variant="text" disabled>
          <SvgIcon icon="file" />
        </Button>
        <h2>{testNameEditable}</h2>
        {testSelection}
        <Button variant="text" onClick={onDeleteTest}>
          <SvgIcon icon="trashcan" />
        </Button>
        <Button
          variant="text"
          onClick={onRunTest}
          disabled={testsRunning && testsRunning.find(t => t._id === item._id)}>
          <SvgIcon icon="play" />
        </Button>
      </div>
      {collapse && (
        <div
          initial={{ height: collapse ? '100%' : '0px' }}
          animate={{ height: collapse ? '100%' : '0px' }}>
          {children}
        </div>
      )}
    </StyledResultListItem>
  );
};

export default UnitTestItem;
