import React, { FunctionComponent, useRef } from 'react';
import styled from 'styled-components';

import { CodeEditor, UnconnectedCodeEditor } from './codemirror/code-editor';
import { Pane, PaneHeader } from './panes/pane';
import { WebsocketActionBar } from './websockets/action-bar';
import { useWSControl } from './websockets/use-ws-control';

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

const StretchedPaneHeader = styled(PaneHeader)({ '&&': { alignItems: 'stretch' } });
export const WebSocketRequestPane: FunctionComponent<Props> = ({ requestId }) => {
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  const { send } = useWSControl(requestId);
  const handleSubmit = async () => {
    const msg = editorRef.current?.getValue() || '';
    const sanitized = msg.trim();
    send(sanitized);
  };

  return (
    <Pane type="request">
      <StretchedPaneHeader>
        <WebsocketActionBar requestId={requestId} />
      </StretchedPaneHeader>
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
    </Pane>
  );
};
