import React, { FunctionComponent } from 'react';
import styled from 'styled-components';

export interface UnitTestRequestSelectorProps {
  onSetActiveRequest: React.ChangeEventHandler<HTMLSelectElement>;
  selectedRequestId?: string | null;
  selectableRequests: {
    name: string;
    request: Request & {
      _id: string;
    };
  }[];
}

const StyledUnitTestRequestSelector = styled.div`
  padding: 0 var(--padding-sm);
  border: 1px solid var(--hl-md);
  border-radius: var(--radius-sm);
  margin: var(--padding-sm) var(--padding-sm) var(--padding-sm) auto;
  max-width: 18rem;
  flex: 0 0 auto;
  select {
    max-width: 18rem;
    height: var(--line-height-xs);
    border: none !important;
    background: none !important;
    color: var(--font-color);

    &:focus {
      outline: 0;
    }
  }
  * {
    margin: 0px;
  }
`;

export const UnitTestRequestSelector: FunctionComponent<UnitTestRequestSelectorProps> = ({
  onSetActiveRequest,
  selectedRequestId,
  selectableRequests,
}) => {
  return (
    <StyledUnitTestRequestSelector>
      <select
        name="request"
        id="request"
        onChange={onSetActiveRequest}
        defaultValue={selectedRequestId || '__NULL__'}
      >
        <option value="__NULL__">
          {selectableRequests.length ? '-- Select Request --' : '-- No Requests --'}
        </option>
        {selectableRequests.map(({ name, request }) => (
          <option key={request._id} value={request._id}>
            {name}
          </option>
        ))}
      </select>
    </StyledUnitTestRequestSelector>
  );
};
