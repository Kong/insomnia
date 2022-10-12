import React, { FunctionComponent, ReactNode } from 'react';
import useToggle from 'react-use/lib/useToggle';
import styled from 'styled-components';

import { SvgIcon } from '../svg-icon';
import { Button } from '../themed-button';
import { ListGroupItem } from './list-group-item';
import { UnitTestRequestSelector } from './unit-test-request-selector';

export interface TestItem {
  _id: string;
}

export interface UnitTestItemProps {
  item: TestItem;
  children?: ReactNode;
  onDeleteTest?: () => void;
  onRunTest?: () => void;
  testNameEditable?: ReactNode;
  testsRunning?: TestItem[] | null;
  onSetActiveRequest: React.ChangeEventHandler<HTMLSelectElement>;
  selectedRequestId?: string | null;
  selectableRequests: {
    name: string;
    request: Request & {
      _id: string;
    };
  }[];
}

const StyledResultListItem = styled(ListGroupItem)`
  && {
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
  }
`;

const StyledUnitTestContent = styled.div`
  display: block;
  height: 0px;
  overflow: hidden;
`;

export const UnitTestItem: FunctionComponent<UnitTestItemProps> = ({
  item,
  children,
  onDeleteTest,
  onRunTest,
  testNameEditable,
  testsRunning,
  onSetActiveRequest,
  selectedRequestId,
  selectableRequests,
}) => {
  const [isToggled, toggle] = useToggle(false);
  const toggleIconRotation = -90;

  return (
    <StyledResultListItem>
      <div>
        <Button
          onClick={toggle}
          variant="text"
          style={isToggled ? {} : { transform: `rotate(${toggleIconRotation}deg)` }}
        >
          <SvgIcon icon="chevron-down" />
        </Button>

        <Button variant="text" disabled>
          <SvgIcon icon="file" />
        </Button>

        <h2>{testNameEditable}</h2>

        <UnitTestRequestSelector
          selectedRequestId={selectedRequestId}
          selectableRequests={selectableRequests}
          onSetActiveRequest={onSetActiveRequest}
        />

        <Button variant="text" onClick={onDeleteTest}>
          <SvgIcon icon="trashcan" />
        </Button>

        <Button
          variant="text"
          onClick={onRunTest}
          disabled={Boolean(testsRunning?.find(({ _id }) => _id === item._id))}
        >
          <SvgIcon icon="play" />
        </Button>
      </div>

      <StyledUnitTestContent
        style={{
          height: isToggled ? '100%' : '0px',
        }}
      >
        {isToggled && <div>{children}</div>}
      </StyledUnitTestContent>
    </StyledResultListItem>
  );
};
