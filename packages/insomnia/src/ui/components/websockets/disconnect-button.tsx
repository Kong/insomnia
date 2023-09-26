import React, { FC } from 'react';
import styled from 'styled-components';

import { Dropdown as OriginalDropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';

const SplitButton = styled.div({
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  display: 'flex',
  color: 'var(--color-font-surprise)',
});
const Dropdown = styled(OriginalDropdown)({
  display: 'flex',
  textAlign: 'center',
  borderLeft: '1px solid var(--hl-md)',
  background: 'var(--color-danger)',
  ':hover': {
    opacity: 0.9,
  },
});
const StyledDropdownButton = styled(DropdownButton)({
  paddingRight: 'var(--padding-xs)',
  paddingLeft: 'var(--padding-xs)',
});
const ActionButton = styled.button({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  background: 'var(--color-danger)',
  ':hover': {
    opacity: 0.9,
  },
});
const Connections = styled.div({
  display: 'flex',
  justifyContent: 'space-evenly',
  width: 25,
});
const Connection = styled.div<{ size?: number }>(({ size = 10 }) => ({
  borderRadius: '50%',
  width: size,
  height: size,
  background: 'var(--color-success)',
}));
const TextWrapper = styled.div({
  textAlign: 'left',
  width: '100%',
  paddingLeft: 'var(--padding-xs)',
});

export const DisconnectButton: FC<{ requestId: string }> = ({ requestId }) => {
  const handleCloseThisRequest = () => {
    window.main.webSocket.close({ requestId });
  };
  const handleCloseAllRequests = () => {
    window.main.webSocket.closeAll();
  };
  return (
    <SplitButton>
      <ActionButton
        type="button"
        onClick={handleCloseThisRequest}
      >
        Disconnect
      </ActionButton>
      <Dropdown
        key="dropdown"
        className="tall"
        data-testid="DisconnectDropdown__Dropdown"
        aria-label='Disconnect Dropdown'
        triggerButton={
          <StyledDropdownButton
            name="DisconnectDropdown__DropdownButton"
          >
            <i className="fa fa-caret-down" />
          </StyledDropdownButton>
        }
      >
        <DropdownItem aria-label='Disconnect this request'>
          <ItemContent onClick={handleCloseThisRequest}>
            <Connections>
              <Connection />
            </Connections>
            <TextWrapper>
              Disconnect this request
            </TextWrapper>
          </ItemContent>
        </DropdownItem>
        <DropdownItem aria-label='Disconnect all requests'>
          <ItemContent onClick={handleCloseAllRequests}>
            <Connections>
              <Connection size={5} />
              <Connection size={5} />
              <Connection size={5} />
            </Connections>
            <TextWrapper>
              Disconnect all requests
            </TextWrapper>
          </ItemContent>
        </DropdownItem>
      </Dropdown>
    </SplitButton>
  );
};
