import React, { ChangeEvent, FC, FormEvent } from 'react';
import styled from 'styled-components';

import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';

const Button = styled.button<{ warning?: boolean }>(({ warning }) => ({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  background: warning ? 'var(--color-danger)' : 'var(--color-surprise)',
  color: 'var(--color-font-surprise)',
  flex: '0 0 100px',
  ':hover': {
    filter: 'brightness(0.8)',
  },
}));

interface ActionButtonProps {
  requestId: string;
  readyState: ReadyState;
}
const ActionButton: FC<ActionButtonProps> = ({ requestId, readyState }) => {

  if (readyState === ReadyState.CONNECTING || readyState === ReadyState.CLOSED) {
    return (
      <Button
        name="websocketActionConnectBtn"
        type="submit"
        form="websocketUrlForm"
      >
        Connect
      </Button>
    );
  }

  return (
    <Button
      className="urlbar__send-btn"
      name="websocketActionCloseBtn"
      type="button"
      warning
      onClick={() => {
        window.main.webSocket.close({ requestId });
      }}
    >
      Disconnect
    </Button>
  );
};

interface ActionBarProps {
  requestId: string;
  workspaceId: string;
  defaultValue: string;
  readyState: ReadyState;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const Form = styled.form({
  flex: 1,
  display: 'flex',
});

const Input = styled.input({
  boxSizing: 'border-box',
  width: '100%',
  height: '100%',
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
});

const WebSocketIcon = styled.span({
  color: 'var(--color-notice)',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 'var(--padding-md)',
});

const ConnectionStatus = styled.span({
  color: 'var(--color-success)',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 'var(--padding-md)',
});
const ConnectionCircle = styled.span({
  backgroundColor: 'var(--color-success)',
  marginRight: 'var(--padding-sm)',
  width: 10,
  height: 10,
  borderRadius: '50%',
});

export const WebSocketActionBar: FC<ActionBarProps> = ({ requestId, workspaceId, defaultValue, onChange, readyState }) => {
  const isOpen = readyState === ReadyState.OPEN;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.main.webSocket.create({ requestId, workspaceId });
  };

  return (
    <>
      {!isOpen && <WebSocketIcon>WS</WebSocketIcon>}
      {isOpen && (
        <ConnectionStatus>
          <ConnectionCircle />
          CONNECTED
        </ConnectionStatus>
      )}
      <Form aria-disabled={isOpen} id="websocketUrlForm" onSubmit={handleSubmit}>
        <Input
          name="websocketUrlInput"
          disabled={readyState === ReadyState.OPEN}
          placeholder="wss://example.com/chat"
          defaultValue={defaultValue}
          onChange={onChange}
        />
      </Form>
      <ActionButton requestId={requestId} readyState={readyState} />
    </>
  );
};
