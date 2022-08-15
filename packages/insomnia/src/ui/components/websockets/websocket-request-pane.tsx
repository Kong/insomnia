import React, { FC, FormEvent, useRef } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { WebSocketRequest } from '../../../models/websocket-request';
import { createWebSocketClient } from '../../context/websocket-client/create-websocket-client';
import { useWebSocketClient, WebSocketClientProvider } from '../../context/websocket-client/websocket-client-context';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { WebsocketActionBar } from './action-bar';

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
});
const Title = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});
const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { alignItems: 'stretch' },
});

const WebSocketRequestForm: FC<{ requestId: string }> = ({ requestId }) => {
  const { send } = useWebSocketClient();
  const editorRef = useRef<UnconnectedCodeEditor>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

interface Props {
  request: WebSocketRequest;
  useBulkHeaderEditor: boolean;
  toggleBulkHeaderEditor: () => void;
}

// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
// TODO: @gatzjames discuss above assertion in light of request and settings drills
export const WebSocketRequestPane: FC<Props> = ({
  request,
  useBulkHeaderEditor,
  toggleBulkHeaderEditor,
}) => {
  const wsClient = createWebSocketClient();
  return (
    <WebSocketClientProvider client={wsClient}>
      <Pane type="request">
        <PaneHeader>
          <WebsocketActionBar requestId={request._id} />
        </PaneHeader>
        <PaneBody>
          <Tabs className="pane__body theme--pane__body react-tabs">
            <TabList>
              <PaneBodyTitle>
                <Title>
                  <Tab tabIndex="-1" >
                    <button>Message</button>
                  </Tab>
                  <Tab tabIndex="-1" >
                    <button>Headers</button>
                  </Tab>
                </Title>
                <ButtonWrapper>
                  <SendButton
                    type="submit"
                    form="websocketMessageForm"
                  >
                    Send
                  </SendButton>
                </ButtonWrapper>
              </PaneBodyTitle>
            </TabList>
            <PaneBodyContent>
              <TabPanel className="react-tabs__tab-panel">
                <WebSocketRequestForm requestId={request._id} />
              </TabPanel>
              <TabPanel className="react-tabs__tab-panel header-editor">
                <RequestHeadersEditor
                  request={request}
                  bulk={useBulkHeaderEditor}
                />
                <div className="pad-right text-right">
                  <button
                    className="margin-top-sm btn btn--clicky"
                    onClick={toggleBulkHeaderEditor}
                  >
                    {useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
                  </button>
                </div>
              </TabPanel>
            </PaneBodyContent>
          </Tabs>
        </PaneBody>
      </Pane>
    </WebSocketClientProvider>
  );
};
