import React, { FunctionComponent, useEffect } from 'react';
import styled from 'styled-components';

import { ReadyState } from './types';
import { useWSControl } from './use-ws-control';
import { useWSReadyState } from './use-ws-ready-state';

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
const ActionButton: FunctionComponent<ActionButtonProps> = ({ requestId, readyState }) => {
  const { close } = useWSControl(requestId);

  if (readyState === ReadyState.CONNECTING || readyState === ReadyState.CLOSED) {
    return (
      <Button
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
      type="button"
      onClick={() => {
        close();
      }}
    >
      Close
    </Button>
  );
};

interface ActionBarProps {
  requestId: string;
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

export const WebsocketActionBar: FunctionComponent<ActionBarProps> = ({ requestId }) => {
  const { connect, close } = useWSControl(requestId);
  const readyState = useWSReadyState(requestId);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = (formData.get('websocketUrlInput') as string) || '';
    connect(url);
  };

  useEffect(() => {
    close();
  }, [close]);

  return (
    <>
      <WebSocketIcon>WS</WebSocketIcon>
      <Form aria-disabled={readyState === ReadyState.OPEN} id="websocketUrlForm" onSubmit={handleSubmit}>
        <Input
          name="websocketUrlInput"
          disabled={readyState === ReadyState.OPEN}
          required
          placeholder="wss://ws-feed.exchange.coinbase.com"
        />
      </Form>
      <ActionButton requestId={requestId} readyState={readyState} />
    </>
  );
};
