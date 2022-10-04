import React, { FC, useRef } from 'react';
import styled from 'styled-components';

import { Dropdown as OriginalDropdown, DropdownHandle } from '../base/dropdown/dropdown';
import { DROPDOWN_BUTTON_DISPLAY_NAME, DropdownButton as OriginalDropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';

const SplitButton = styled.div({
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
const DropdownButton = styled(OriginalDropdownButton)({
  paddingRight: 'var(--padding-xs)',
  paddingLeft: 'var(--padding-xs)',
});
DropdownButton.displayName = DROPDOWN_BUTTON_DISPLAY_NAME;
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
  const dropdownRef = useRef<DropdownHandle>();
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
        right
        data-testid="DisconnectDropdown__Dropdown"
      >
        <DropdownButton
          name="DisconnectDropdown__DropdownButton"
          onClick={() => dropdownRef.current?.show()}
        >
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem unsetStyles onClick={handleCloseThisRequest}>
          <Connections>
            <Connection />
          </Connections>
          <TextWrapper>
            Disconnect this request
          </TextWrapper>
        </DropdownItem>
        <DropdownItem unsetStyles onClick={handleCloseAllRequests}>
          <Connections>
            <Connection size={5} />
            <Connection size={5} />
            <Connection size={5} />
          </Connections>
          <TextWrapper>
            Disconnect all requests
          </TextWrapper>
        </DropdownItem>
      </Dropdown>
    </SplitButton>
  );
};
