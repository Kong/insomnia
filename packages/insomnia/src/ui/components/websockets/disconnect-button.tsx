import React, { type FC, type PropsWithChildren } from 'react';

import { Dropdown as OriginalDropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';

const Connections: FC<PropsWithChildren> = ({ children }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-evenly',
      width: 25,
    }}
  >
    {children}
  </div>
);

const Connection: FC<PropsWithChildren & { size?: number }> = ({ size = 10 }) => (
  <div
    style={{
      borderRadius: '50%',
      width: size,
      height: size,
      background: 'var(--color-success)',
    }}
  />
);

const TextWrapper: FC<PropsWithChildren> = ({ children }) => (
  <div
    style={{
      textAlign: 'left',
      width: '100%',
      paddingLeft: 'var(--padding-xs)',
    }}
  >
    {children}
  </div>
);

export const DisconnectButton: FC<{ requestId: string }> = ({ requestId }) => {
  const handleCloseThisRequest = () => {
    window.main.webSocket.close({ requestId });
  };
  const handleCloseAllRequests = () => {
    window.main.webSocket.closeAll();
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
        aria-label='Disconnect Dropdown'
        triggerButton={
          <DropdownButton
            style={{
              paddingRight: 'var(--padding-xs)',
              paddingLeft: 'var(--padding-xs)',
            }}
            name="DisconnectDropdown__DropdownButton"
          >
            <i className="fa fa-caret-down" />
          </DropdownButton>
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
      </OriginalDropdown>
    </div>
  );
};
