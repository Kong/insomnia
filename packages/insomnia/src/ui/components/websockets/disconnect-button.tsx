import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { isSocketIORequestId } from '../../../models/socket-io-request';
import { isWebSocketRequestId } from '../../../models/websocket-request';
import { Dropdown as OriginalDropdown, DropdownItem, ItemContent } from '../base/dropdown';

export const DisconnectButton: FC<{ requestId: string }> = ({ requestId }) => {
  const handleCloseThisRequest = () => {
    if (isWebSocketRequestId(requestId)) {
      window.main.webSocket.close({ requestId });
    } else if (isSocketIORequestId(requestId)) {
      window.main.socketIO.close({ requestId });
    }
  };
  const handleCloseAllRequests = () => {
    if (isWebSocketRequestId(requestId)) {
      window.main.webSocket.closeAll();
    } else if (isSocketIORequestId(requestId)) {
      window.main.socketIO.closeAll();
    }
  };
  return (
    <div
      style={{
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        display: 'flex',
        color: 'var(--color-font-surprise)',
      }}
    >
      <button
        type="button"
        style={{
          paddingRight: 'var(--padding-md)',
          paddingLeft: 'var(--padding-md)',
          background: 'var(--color-danger)',
        }}
        onClick={handleCloseThisRequest}
      >
        Disconnect
      </button>
      <OriginalDropdown
        className="tall"
        style={{
          display: 'flex',
          textAlign: 'center',
          borderLeft: '1px solid var(--hl-md)',
          background: 'var(--color-danger)',
        }}
        key="dropdown"
        data-testid="DisconnectDropdown__Dropdown"
        aria-label="Disconnect Dropdown"
        triggerButton={
          <Button
            style={{
              paddingRight: 'var(--padding-xs)',
              paddingLeft: 'var(--padding-xs)',
            }}
            name="DisconnectDropdown__DropdownButton"
          >
            <i className="fa fa-caret-down" />
          </Button>
        }
      >
        <DropdownItem aria-label="Disconnect this request">
          <ItemContent onClick={handleCloseThisRequest}>
            <div className="flex w-[25px] justify-evenly">
              <div className="bg-success h-[10px] w-[10px] rounded-[50%]" />
            </div>
            <div className="w-full pl-[--padding-xs] text-left">Disconnect this request</div>
          </ItemContent>
        </DropdownItem>
        <DropdownItem aria-label="Disconnect all requests">
          <ItemContent onClick={handleCloseAllRequests}>
            <div className="flex w-[25px] justify-evenly">
              <div className="bg-success h-[5px] w-[5px] rounded-[50%]" />
              <div className="bg-success h-[5px] w-[5px] rounded-[50%]" />
              <div className="bg-success h-[5px] w-[5px] rounded-[50%]" />
            </div>
            <div className="w-full pl-[--padding-xs] text-left">Disconnect all requests</div>
          </ItemContent>
        </DropdownItem>
      </OriginalDropdown>
    </div>
  );
};
