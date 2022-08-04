import React, { FunctionComponent, useEffect } from 'react';
import styled from 'styled-components';

import { ReadyState } from './types';
import { useWSControl } from './use-ws-control';
import { useWSReadyState } from './use-ws-ready-state';

interface StateIndicatorProps {
  readyState: ReadyState;
}
const StateIndicator: FunctionComponent<StateIndicatorProps> = ({ readyState }) => {
  return <div>{ReadyState[readyState]}</div>;
};

interface ActionButtonProps {
  requestId: string;
  readyState: ReadyState;
}
const ActionButton: FunctionComponent<ActionButtonProps> = ({ requestId, readyState }) => {
  const { close, send } = useWSControl(requestId);

  if (readyState === ReadyState.CONNECTING || readyState === ReadyState.CLOSED) {
    return (
      <button
        type="submit"
        form="websocketUrlForm"
      >
        Connect
      </button>
    );
  }

  if (readyState === ReadyState.OPEN) {
    return (
      <>
        <button
          type="button"
          form="websocketMessageForm"
          onClick={() => send(JSON.stringify({
            type: 'subscribe',
            channels: [
              {
                name: 'level2',
                product_ids: ['BTC-USD'],
              },
            ],
          }))}
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => {
            close();
          }}
        >
          Close
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        close();
      }}
    >
      Close
    </button>
  );
};

interface ActionBarProps {
  requestId: string;
}
const Container = styled.div({
  display: 'flex',
  flexDirection: 'row',
});
const Form = styled.form({
  flex: '1',
});
const Input = styled.input({
  width: '100%',
});
export const WebsocketActionBar: FunctionComponent<ActionBarProps> = ({ requestId }) => {
  const { connect } = useWSControl(requestId);
  const readyState = useWSReadyState(requestId);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const url = (formData.get('websocketUrlInput') as string) || '';
    connect(url);
  };

  useEffect(() => {
    window.main.webSocketConnection.close({ requestId });
  }, [requestId]);

  return (
    <Container>
      <StateIndicator readyState={readyState} />
      <Form id="websocketUrlForm" onSubmit={handleSubmit}>
        <Input
          name="websocketUrlInput"
          required
          placeholder="wss://ws-feed.exchange.coinbase.com"
          defaultValue="wss://ws-feed.exchange.coinbase.com"
        />
      </Form>
      <ActionButton requestId={requestId} readyState={readyState} />
    </Container>
  );
};
