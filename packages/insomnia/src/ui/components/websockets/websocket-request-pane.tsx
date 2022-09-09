import React, { FC, FormEvent, useEffect, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { AuthType, CONTENT_TYPE_JSON } from '../../../common/constants';
import { getRenderContext, render, RENDER_PURPOSE_SEND } from '../../../common/render';
import * as models from '../../../models';
import { WebSocketRequest } from '../../../models/websocket-request';
import { ReadyState, useWSReadyState } from '../../context/websocket-client/use-ws-ready-state';
import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { WebSocketPreviewModeDropdown } from '../dropdowns/websocket-preview-mode';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { showAlert, showModal } from '../modals';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
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
  marginLeft: 'var(--padding-xs)',
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

interface FormProps {
  request: WebSocketRequest;
  previewMode: string;
  initialValue: string;
  environmentId: string;
  createOrUpdatePayload: (payload: string, mode: string) => Promise<void>;
}

const WebSocketRequestForm: FC<FormProps> = ({
  request,
  previewMode,
  initialValue,
  createOrUpdatePayload,
  environmentId,
}) => {
  const editorRef = useRef<UnconnectedCodeEditor>(null);
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      editorRef.current?.codeMirror?.setValue(initialValue);
    }
    return () => {
      isMounted = false;
    };
  }, [initialValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = editorRef.current?.getValue() || '';

    try {
      // Render any nunjucks tag in the message
      const renderContext = await getRenderContext({ request, environmentId, purpose: RENDER_PURPOSE_SEND });
      const renderedMessage = await render(message, renderContext);

      window.main.websocket.event.send({ requestId: request._id, message: renderedMessage });
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

  // TODO(@dmarby): Wrap the CodeEditor in a NunjucksEnabledProvider here?
  // To allow for disabling rendering of messages based on a per-request setting.
  // Same as with regular requests
  return (
    <SendMessageForm id="websocketMessageForm" onSubmit={handleSubmit}>
      <EditorWrapper>
        <CodeEditor
          uniquenessKey={request._id}
          mode={previewMode}
          ref={editorRef}
          defaultValue=''
          onChange={value => createOrUpdatePayload(value, previewMode)}
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
  forceRefreshKey: number;
}

export const WebSocketRequestPane: FC<Props> = ({ request, workspaceId, environmentId, forceRefreshKey }) => {
  const readyState = useWSReadyState(request._id);

  const disabled = readyState === ReadyState.OPEN || readyState === ReadyState.CLOSING;
  const handleOnChange = (url: string) => {
    if (url !== request.url) {
      models.websocketRequest.update(request, { url });
    }
  };
  const [previewMode, setPreviewMode] = useState(CONTENT_TYPE_JSON);
  const [initialValue, setInitialValue] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      const payload = await models.websocketPayload.getByParentId(request._id);
      if (isMounted && payload) {
        setInitialValue(payload.value);
        setPreviewMode(payload.mode);
      }
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [request._id]);

  const changeMode = (mode: string) => {
    setPreviewMode(mode);
    createOrUpdatePayload(initialValue, mode);
  };

  const createOrUpdatePayload = async (value: string, mode: string) => {
    // @TODO: multiple payloads
    const payload = await models.websocketPayload.getByParentId(request._id);
    if (payload) {
      await models.websocketPayload.update(payload, { value, mode });
      return;
    }
    await models.websocketPayload.create({
      parentId: request._id,
      value,
      mode,
    });
  };

  const uniqueKey = `${forceRefreshKey}::${request._id}`;

  return (
    <Pane type="request">
      <PaneHeader>
        <WebSocketActionBar
          key={uniqueKey}
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
            <WebSocketPreviewModeDropdown previewMode={previewMode} onClick={changeMode} />
          </Tab>
          <Tab tabIndex="-1">
            <AuthDropdown authTypes={supportedAuthTypes} disabled={disabled} />
          </Tab>
          <Tab tabIndex="-1">
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
            key={uniqueKey}
            request={request}
            previewMode={previewMode}
            initialValue={initialValue}
            createOrUpdatePayload={createOrUpdatePayload}
            environmentId={environmentId}
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <AuthWrapper
            key={`${uniqueKey}-${request.authentication.type}-auth-header`}
            disabled={
              readyState === ReadyState.OPEN ||
              readyState === ReadyState.CLOSING
            }
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel header-editor">
          <RequestHeadersEditor
            key={`${uniqueKey}-${readyState}-header-editor`}
            request={request}
            bulk={false}
            isDisabled={readyState === ReadyState.OPEN}
          />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
