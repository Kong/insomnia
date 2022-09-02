import React, { ChangeEvent, FC, FormEvent, useRef } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { AuthType } from '../../../common/constants';
import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../../../common/render';
import * as models from '../../../models';
import { WebSocketRequest } from '../../../models/websocket-request';
import { ReadyState, useWSReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { Pane, PaneHeader as OriginalPaneHeader } from '../panes/pane';
import { WebSocketActionBar } from './action-bar';

const supportedAuthTypes: AuthType[] = ['basic', 'bearer'];

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

const WebSocketRequestForm: FC<{ request: WebSocketRequest; environmentId: string }> = ({ request, environmentId }) => {
  const editorRef = useRef<UnconnectedCodeEditor>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = editorRef.current?.getValue() || '';

    // Render any nunjucks tag in the message
    const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });
    const renderedMessage = await render(message, renderContext);

    // TODO: Handle error in rendering because of non-existent variable etc...

    window.main.webSocket.event.send({ requestId: request._id, message: renderedMessage });
  };
  // TODO(@dmarby): Wrap the CodeEditor in a NunjucksEnabledProvider here?
  // To allow for disabling rendering of messages based on a per-request setting.
  // Same as with regular requests

  return (
    <SendMessageForm id="websocketMessageForm" onSubmit={handleSubmit}>
      <EditorWrapper>
        <CodeEditor
          uniquenessKey={request._id}
          ref={editorRef}
          defaultValue=''
          enableNunjucks
        />
      </EditorWrapper>
    </SendMessageForm>
  );
};

interface Props {
  request: WebSocketRequest;
  workspaceId: string;
  environmentId: string;
}

// requestId is something we can read from the router params in the future.
// essentially we can lift up the states and merge request pane and response pane into a single page and divide the UI there.
// currently this is blocked by the way page layout divide the panes with dragging functionality
// TODO: @gatzjames discuss above assertion in light of request and settings drills
export const WebSocketRequestPane: FC<Props> = ({ request, workspaceId, environmentId }) => {
  const readyState = useWSReadyState(request._id);
  const disabled = readyState === ReadyState.OPEN || readyState === ReadyState.CLOSING;
  const handleOnChange = (url: string) => {
    if (url !== request.url) {
      models.websocketRequest.update(request, { url });
    }
  };

  // TODO: Check if we need any keys/force refresh here to correctly update rendering of nunjucks tags
  // Definitely needed for headers

  return (
    <Pane type="request">
      <PaneHeader>
        <WebSocketActionBar
          key={request._id}
          request={request}
          workspaceId={workspaceId}
          environmentId={environmentId}
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
            <AuthDropdown
              authTypes={supportedAuthTypes}
              disabled={disabled}
            />
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
          <WebSocketRequestForm
            key={`${environmentId}::${request._id}`} // Needed to ensure nunjucks rendering updates on environment change
            request={request}
            environmentId={environmentId}
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <AuthWrapper
            key={`${request._id}-${request.authentication.type}-auth-header`}
            disabled={readyState === ReadyState.OPEN || readyState === ReadyState.CLOSING}
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel header-editor">
          <RequestHeadersEditor
            key={`${request._id}-${readyState}-header-editor`}
            request={request}
            bulk={false}
            isDisabled={readyState === ReadyState.OPEN}
          />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
