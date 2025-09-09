import type { IChangeEvent } from '@rjsf/core';
import type { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import React, { type FC, useEffect, useRef, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { PrimitiveSubItemTypes } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp';
import { InsomniaRjsfForm } from '~/ui/components/rjsf';

import { type AuthTypes } from '../../../common/constants';
import type { Environment } from '../../../models/environment';
import { getAuthObjectOrNull } from '../../../network/authentication';
import { useMcpRequestLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.request.$requestId';
import { useRequestPatcher } from '../../hooks/use-request';
import { CodeEditor, type CodeEditorHandle } from '../.client/codemirror/code-editor';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { readOnlyWebsocketPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { Pane } from '../panes/pane';
import { McpUrlActionBar } from './mcp-url-bar';

const supportedAuthTypes: AuthTypes[] = ['apikey', 'basic', 'bearer'];

const PaneReadOnlyBanner = () => {
  return (
    <div
      style={{
        paddingTop: 'var(--padding-md)',
        paddingLeft: 'var(--padding-md)',
        paddingRight: 'var(--padding-md)',
      }}
    >
      <p className="notice info no-margin-top no-margin-bottom">
        This section is now locked since the connection has already been established. To change these settings, please
        disconnect first.
      </p>
    </div>
  );
};

interface Props {
  environment: Environment | null;
  readyState: boolean;
  selectedPrimitiveItem?: PrimitiveSubItemTypes | null;
}

export const McpRequestPane: FC<Props> = ({ environment, readyState, selectedPrimitiveItem }) => {
  const { activeRequest } = useMcpRequestLoaderData()!;
  const [formData, setFormData] = useState({});
  const paramEditorRef = useRef<CodeEditorHandle>(null);
  const requestId = activeRequest._id;

  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyWebsocketPairs.length;

  const patchRequest = useRequestPatcher();
  // Reset the response pane state when we switch requests, the environment gets modified
  const uniqueKey = `${environment?.modified}::${requestId}`;
  const requestAuth = getAuthObjectOrNull(activeRequest.authentication);
  const isNoneOrInherited = requestAuth?.type === 'none' || requestAuth === null;
  const toolsSchema = selectedPrimitiveItem?.type === 'tools' ? selectedPrimitiveItem.inputSchema : undefined;

  const handleRjsfFormChange = (e: IChangeEvent) => {
    setFormData(e.formData);
    paramEditorRef.current?.setValue(JSON.stringify(e.formData, null, 2));
  };

  useEffect(() => {
    setFormData({});
    paramEditorRef.current?.setValue('');
  }, [selectedPrimitiveItem]);

  const handleSend = () => {
    window.main.mcp.primitive.callTool({
      name: selectedPrimitiveItem?.name || '',
      parameters: formData,
      requestId: requestId,
    });
  };

  return (
    <Pane type="request">
      <header className="pane__header theme--pane__header !items-stretch">
        <McpUrlActionBar
          key={uniqueKey}
          request={activeRequest}
          environmentId={environment?._id || ''}
          defaultValue={activeRequest.url}
          readyState={readyState}
          onChange={url => patchRequest(requestId, { url })}
        />
      </header>
      <Tabs aria-label="Websocket request pane tabs" className="flex h-full w-full flex-1 flex-col">
        <TabList
          className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
          aria-label="Request pane tabs"
        >
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="params"
          >
            <span>Params</span>
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="auth"
          >
            <span>Auth</span>
            {!isNoneOrInherited && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="headers"
          >
            <span>Headers</span>
            {headersCount > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                {headersCount}
              </span>
            )}
          </Tab>
        </TabList>
        <TabPanel className="flex h-full w-full flex-1 flex-col overflow-y-auto" id="params">
          {!readyState ? (
            <div className="flex h-full w-full flex-col items-center gap-3 pt-[5%] text-center">
              {/*  Hint when mcp server is not connected*/}
              <span className="text-md">Enter MCP server url to discover capabilities</span>
            </div>
          ) : (
            // Todo @CurryYangxx params builder and overview UI
            <PanelGroup className="flex-1 overflow-hidden" direction={'vertical'}>
              <Panel minSize={20}>
                <div className="flex h-full flex-col">
                  <div className="flex h-4 w-full items-center justify-between p-4">
                    <Heading className="text-xs font-bold uppercase text-[--hl]">Parameter Builder</Heading>
                    <div className="flex items-center gap-2">
                      <Button
                        isDisabled={!readyState}
                        onClick={handleSend}
                        className="asma-pressed:bg-[--hl-sm] flex h-full w-[14ch] flex-shrink-0 items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:ring-inset focus:ring-[--hl-md] aria-selected:bg-[--hl-xs] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                  {toolsSchema && (
                    <InsomniaRjsfForm
                      formData={formData}
                      onChange={handleRjsfFormChange}
                      schema={toolsSchema as RJSFSchema}
                      validator={validator}
                    />
                  )}
                </div>
              </Panel>
              <PanelResizeHandle className="h-[1px] w-full bg-[--hl-md]" />
              <Panel minSize={20}>
                <div className="flex h-full flex-col">
                  <Heading className="p-4 text-xs font-bold uppercase text-[--hl]">Parameter Overview</Heading>
                  <div className="flex-1 overflow-hidden">
                    <CodeEditor
                      ref={paramEditorRef}
                      id="mcp-parameter-overview-editor"
                      showPrettifyButton
                      dynamicHeight
                      uniquenessKey="mcp-parameter-overview-editor"
                      defaultValue=""
                      enableNunjucks
                      onChange={() => {}}
                      mode="json"
                      placeholder=""
                    />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          )}
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
          {readyState && <PaneReadOnlyBanner />}
          <AuthWrapper
            key={uniqueKey}
            authentication={activeRequest.authentication}
            disabled={readyState}
            authTypes={supportedAuthTypes}
          />
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="headers">
          {readyState && <PaneReadOnlyBanner />}
          <RequestHeadersEditor
            key={uniqueKey}
            headers={activeRequest.headers}
            bulk={false}
            isDisabled={readyState}
            requestType="McpRequest"
          />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
