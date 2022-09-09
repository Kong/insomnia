import React, { FC, FormEvent } from 'react';
import styled from 'styled-components';

import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../../../common/render';
import { WebSocketRequest } from '../../../models/websocket-request';
import { ReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { showAlert, showModal } from '../modals';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';

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

    try {
      const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });

      const { url, headers, authentication } = request;

      // Render any nunjucks tags in the url/headers/authentication settings
      const rendered = await render({
        url,
        headers,
        authentication,
      }, renderContext);

      window.main.webSocket.create({
        requestId: request._id,
        workspaceId,
        url: rendered.url,
        headers: rendered.headers,
        authentication: rendered.authentication,
      });
    } catch (err) {
      if (err.type === 'render') {
        showModal(RequestRenderErrorModal, {
          request,
          error: err,
        });
      } else {
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{err.message}</pre>
              </code>
            </div>
          ),
        });
      }
    }
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
        <StyledUrlBar>
          <OneLineEditor
            disabled={readyState === ReadyState.OPEN}
            placeholder="wss://example.com/chat"
            defaultValue={defaultValue}
            onChange={onChange}
            type="text"
            forceEditor
          />
        </StyledUrlBar>
      </Form>
      <ActionButton requestId={request._id} readyState={readyState} />
    </>
  );
};
