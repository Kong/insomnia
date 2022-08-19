import React, { ChangeEvent, FC, FormEvent, useRef } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import * as models from '../../../models';
import { WebSocketRequest } from '../../../models/websocket-request';
import { ReadyState, useWSReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { WebSocketActionBar } from './action-bar';

const EditorWrapper = styled.div({
  height: '100%',
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
    filter: 'brightness(0.8)',
  },
});
const PaneSendButton = styled.div({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'flex-end',
  boxSizing: 'border-box',
  height: 'var(--line-height-sm)',
  borderBottom: '1px solid var(--hl-lg)',
  padding: 3,
});
const PaneHeader = styled(OriginalPaneHeader)({
  '&&': { alignItems: 'stretch' },
});

const WebSocketRequestForm: FC<{ requestId: string }> = ({ requestId }) => {
  const editorRef = useRef<UnconnectedCodeEditor>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = editorRef.current?.getValue() || '';
    window.main.webSocketConnection.event.send({ requestId, message });
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
}

// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
// TODO: @gatzjames discuss above assertion in light of request and settings drills
export const WebSocketRequestPane: FC<Props> = ({ request }) => {
  const readyState = useWSReadyState(request._id);
  const handleOnChange = (event: ChangeEvent<HTMLInputElement>) => {
    const url = event.currentTarget.value || '';
    if (url !== request.url) {
      models.websocketRequest.update(request, { url });
    }
  };

  return (
    <Pane type="request">
      <PaneHeader>
        <WebSocketActionBar
          key={request._id}
          requestId={request._id}
          defaultValue={request.url}
          readyState={readyState}
          onChange={handleOnChange}
        />
      </PaneHeader>
      <Tabs className="pane__body theme--pane__body react-tabs">
        <TabList>
          <Tab tabIndex="-1" >
            <button>Message</button>
          </Tab>
          <Tab tabIndex="-1" >
            <button>Headers</button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel">
          <PaneSendButton>
            <SendButton
              type="submit"
              form="websocketMessageForm"
              disabled={readyState !== ReadyState.OPEN}
            >
              Send
            </SendButton>
          </PaneSendButton>
          <WebSocketRequestForm requestId={request._id} />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel header-editor">
          <RequestHeadersEditor
            key={`${request._id}-${readyState}-header-editor`}
            request={request}
            bulk={false}
            isDisabled={readyState !== ReadyState.CLOSED}
          />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
