import React, { FC, useRef } from 'react';
import styled from 'styled-components';

import { Dropdown, DropdownHandle } from '../base/dropdown/dropdown';
import { DROPDOWN_BUTTON_DISPLAY_NAME, DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';

const Button = styled(DropdownButton)({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  background: 'var(--color-danger)',
  color: 'var(--color-font-surprise)',
  height: '100%',
  flex: '0 0 100px',
  ':hover': {
    filter: 'brightness(0.8)',
  },
});

Button.displayName = DROPDOWN_BUTTON_DISPLAY_NAME;
export const DisconnectDropdown: FC<{ requestId: string }> = ({ requestId }) => {
  const dropdownRef = useRef<DropdownHandle>();
  const handleCloseThisRequest = () => {
    console.log('close');
    window.main.webSocket.close({ requestId });
  };
  const handleCloseAllRequests = () => {
    console.log('close all');
    window.main.webSocket.closeAll();
  };
  return (
    <Dropdown
      key="dropdown"
      className="tall"
      right
    >
      <Button onClick={() => dropdownRef.current?.show()}>
        Disconnect
        <i className="fa fa-caret-down space-left" />
      </Button>
      <DropdownItem onClick={handleCloseThisRequest}>
        Disconnect this request
      </DropdownItem>
      <DropdownItem onClick={handleCloseAllRequests}>
        Disconnect all requests
      </DropdownItem>
    </Dropdown>
  );
};
