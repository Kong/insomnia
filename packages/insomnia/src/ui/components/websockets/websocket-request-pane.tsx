import React, { FC, useRef } from 'react';
import styled from 'styled-components';

import { createWebSocketClient } from '../../context/websocket-client/create-websocket-client';
import { useWebSocketClient, WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { WebsocketActionBar } from './action-bar';

interface Props {
  requestId: string;
}
const PaneBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
});
const PaneBodyContent = styled.div({
  flex: 1,
});
const EditorWrapper = styled.div({
  height: '100%',
});
const ButtonWrapper = styled.div({
  paddingTop: 3,
  paddingBottom: 3,
});
const SendMessageForm = styled.form({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});
const SendButton = styled.button({
  padding: '0 var(--padding-md)',
  height: '100%',
  border: '1px solid var(--hl-lg)',
  borderRadius: 'var(--radius-md)',
  ':hover': {
    backgroundColor: 'var(--hl-xs)',
  },
});
const PaneBodyTitle = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  background: 'var(--color-bg)',
  color: 'var(--color-font)',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  alignItems: 'stretch',
  borderBottom: '1px solid var(--hl-md)',
  paddingRight: 'var(--padding-md)',
  paddingLeft: 'var(--padding-md)',
});
const Title = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});
const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { alignItems: 'stretch' },
});

const WebSocketRequestForm: FC<Props> = ({ requestId }) => {
  const { send } = useWebSocketClient();
  const editorRef = useRef<UnconnectedCodeEditor>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const message = editorRef.current?.getValue() || '';
    send({ requestId, message });
  };
  return (
    <SendMessageForm id="websocketMessageForm" onSubmit={handleSubmit}>
      <EditorWrapper>
        <CodeEditor
          uniquenessKey={requestId}
          ref={editorRef}
          defaultValue=''
        />
      </EditorWrapper>
    </SendMessageForm>
  );
};

const wsClient = createWebSocketClient();
// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
export const WebSocketRequestPane: FC<Props> = ({ requestId }) => {
  return (
    <WebSocketClientProvider client={wsClient}>
      <Pane type="request">
        <PaneHeader>
          <WebsocketActionBar requestId={requestId} />
        </PaneHeader>
        <PaneBody>
          <PaneBodyTitle>
            <Title>Message</Title>
            <ButtonWrapper>
              <SendButton
                type="submit"
                form="websocketMessageForm"
              >
                Send
              </SendButton>
            </ButtonWrapper>
          </PaneBodyTitle>
          <PaneBodyContent>
            <WebSocketRequestForm requestId={requestId} />
          </PaneBodyContent>
        </PaneBody>
      </Pane>
    </WebSocketClientProvider>
  );
};
