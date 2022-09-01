import React, { ChangeEvent, FC, FormEvent } from 'react';
import styled from 'styled-components';

import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';

const Button = styled.button({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  background: 'var(--color-surprise)',
  color: 'var(--color-font-surprise)',
  flex: '0 0 100px',
  ':hover': {
    filter: 'brightness(0.8)',
  },
});

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
      onClick={() => {
        window.main.webSocket.close({ requestId });
      }}
    >
      Close
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
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
});

export const WebSocketActionBar: FC<ActionBarProps> = ({ requestId, workspaceId, defaultValue, onChange, readyState }) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.main.webSocket.create({ requestId, workspaceId });
  };

  return (
    <>
      <WebSocketIcon>WS</WebSocketIcon>
      <Form aria-disabled={readyState === ReadyState.OPEN} id="websocketUrlForm" onSubmit={handleSubmit}>
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
