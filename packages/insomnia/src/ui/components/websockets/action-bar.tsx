import React, { ChangeEvent, FC, FormEvent, useEffect } from 'react';
import styled from 'styled-components';

import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { useWebSocketClient } from '../../context/websocket-client/websocket-client-context';

const Button = styled.button({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  background: 'var(--color-surprise)',
  color: 'var(--color-font-surprise)',
  flex: '0 0 100px',
});

interface ActionButtonProps {
  requestId: string;
  readyState: ReadyState;
}
const ActionButton: FC<ActionButtonProps> = ({ requestId, readyState }) => {
  const { close } = useWebSocketClient();

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
        close({ requestId });
      }}
    >
      Close
    </Button>
  );
};

interface ActionBarProps {
  requestId: string;
  requestUrl: string;
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

export const WebSocketActionBar: FC<ActionBarProps> = ({ requestId, requestUrl, onChange, readyState }) => {
  const { create, close } = useWebSocketClient();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create({ requestId });
  };

  useEffect(() => {
    return () => {
      close({ requestId });
    };
  }, [close, requestId]);

  return (
    <>
      <WebSocketIcon>WS</WebSocketIcon>
      <Form aria-disabled={readyState === ReadyState.OPEN} id="websocketUrlForm" onSubmit={handleSubmit}>
        <Input
          name="websocketUrlInput"
          disabled={readyState === ReadyState.OPEN}
          required
          placeholder="wss://ws-feed.exchange.coinbase.com"
          defaultValue={requestUrl}
          onChange={onChange}
        />
      </Form>
      <ActionButton requestId={requestId} readyState={readyState} />
    </>
  );
};
