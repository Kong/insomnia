import React, { FC, FormEvent } from 'react';
import styled from 'styled-components';

import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../../../common/render';
import { WebSocketRequest } from '../../../models/websocket-request';
import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { OneLineEditor } from '../codemirror/one-line-editor';

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
  request: WebSocketRequest;
  workspaceId: string;
  environmentId: string;
  defaultValue: string;
  readyState: ReadyState;
  onChange: (value: string) => void;
}

const Form = styled.form({
  flex: 1,
  display: 'flex',
});

const StyledUrlBar = styled.div({
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

export const WebSocketActionBar: FC<ActionBarProps> = ({ request, workspaceId, environmentId, defaultValue, onChange, readyState }) => {
  const isOpen = readyState === ReadyState.OPEN;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Render any nunjucks tag in the message
    const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });

    // TODO: Should we filter out disabled headers/authentication here, as we do in getRenderedRequestAndContext?

    const { url, headers, authentication } = request;

    const rendered = await render({
      url,
      headers,
      authentication,
    }, renderContext);

    // TODO: Handle error in rendering

    window.main.webSocket.create({
      requestId: request._id,
      workspaceId,
      url: rendered.url,
      headers: rendered.headers,
      authentication: rendered.authentication,
    });
  };

  const uniquenessKey = `${environmentId}::${request._id}`;

  // TODO: Use getAutocompleteConstants to get existing websocket URLs?

  // TODO: How do we handle if you switch to an environment where the variable no longer resolves, and the connection is active?
  // Close the websockets on environment change always, since it also messes with history?

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
        <StyledUrlBar>
          <OneLineEditor
            disabled={readyState === ReadyState.OPEN}
            placeholder="wss://example.com/chat"
            defaultValue={defaultValue}
            onChange={onChange}
            key={uniquenessKey}
            type="text"
            forceEditor
          />
        </StyledUrlBar>
      </Form>
      <ActionButton requestId={request._id} readyState={readyState} />
    </>
  );
};
