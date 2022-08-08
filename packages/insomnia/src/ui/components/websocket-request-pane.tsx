import React, { FunctionComponent, useRef } from 'react';
import styled from 'styled-components';

import { CodeEditor, UnconnectedCodeEditor } from './codemirror/code-editor';
import { Pane, PaneHeader } from './panes/pane';
import { WebsocketActionBar } from './websockets/action-bar';
import { NeDBClientProvider } from './websockets/nedb-client-context';
import { useWebSocketClient, WebSocketClientProvider } from './websockets/websocket-client-context';
interface Props {
  requestId: string;
}
const BodyContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
});
const EditorWrapper = styled.form({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});
const SendButton = styled.button({
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
  textAlign: 'center',
  background: 'var(--color-surprise)',
  color: 'var(--color-font-surprise)',
  flex: '0 0 100px',
});
const TitleWrapper = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  background: 'var(--color-bg)',
  color: 'var(--color-font)',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  alignItems: 'stretch',
});
const Title = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
});
const StretchedPaneHeader = styled(PaneHeader)({
  '&&': { alignItems: 'stretch' },
});

const WebSocketRequestPaneBody: FunctionComponent<Props> = ({ requestId }) => {
  const { send } = useWebSocketClient();
  const editorRef = useRef<UnconnectedCodeEditor>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const message = editorRef.current?.getValue() || '';
    send({ requestId, message });
  };
  return (
    <BodyContainer>
      <TitleWrapper>
        <Title>Message</Title>
        <SendButton type="submit" form="websocketMessageForm">Send</SendButton>
      </TitleWrapper>
      <EditorWrapper id="websocketMessageForm" onSubmit={handleSubmit}>
        <CodeEditor
          uniquenessKey={requestId}
          ref={editorRef}
        />
      </EditorWrapper>
    </BodyContainer>
  );
};

// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
export const WebSocketRequestPane: FunctionComponent<Props> = ({ requestId }) => {
  return (
    <NeDBClientProvider>
      <WebSocketClientProvider>
        <Pane type="request">
          <StretchedPaneHeader>
            <WebsocketActionBar requestId={requestId} />
          </StretchedPaneHeader>
          <WebSocketRequestPaneBody requestId={requestId} />
        </Pane>
      </WebSocketClientProvider>
    </NeDBClientProvider>
  );
};
