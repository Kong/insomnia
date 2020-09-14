// @flow
import * as React from 'react';
import styled from 'styled-components';
import { useToggle } from 'react-use';
import SvgIcon from '../svg-icon';
import Button from '../button';
import ListGroupItem from './list-group-item';
import UnitTestRequestSelector from './unit-test-request-selector';

type Props = {|
  item: Object,
  children?: React.Node,
  onDeleteTest?: () => void,
  onRunTest?: () => void,
  testNameEditable?: React.Node,
  testsRunning?: Object,
  onChange: () => void,
  selectedRequestId?: string,
  selectableRequests: Array<{ name: string, request: { _id: string } }>,
|};

const StyledResultListItem: React.ComponentType<{}> = styled(ListGroupItem)`
  padding: 0 var(--padding-sm);

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
  testNameEditable,
  testsRunning,
  onChange,
  selectedRequestId,
  selectableRequests,
}: Props) => {
  const [isToggled, toggle] = useToggle(false);
  const toggleIconRotation = -90;
  const _handleItemToggle = React.useCallback(() => {
    toggle();
  }, [toggle]);

  return (
    <StyledResultListItem>
      <div>
        <Button
          onClick={_handleItemToggle}
          variant="text"
          style={!isToggled ? { transform: `rotate(${toggleIconRotation}deg)` } : {}}>
          <SvgIcon icon="chevron-down" />
        </Button>
        <Button variant="text" disabled>
          <SvgIcon icon="file" />
        </Button>
        <h2>{testNameEditable}</h2>
        <UnitTestRequestSelector
          selectedRequestId={selectedRequestId}
          selectableRequests={selectableRequests}
          onChange={onChange}
        />
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
      {isToggled && <div>{children}</div>}
    </StyledResultListItem>
  );
};

export default UnitTestItem;
