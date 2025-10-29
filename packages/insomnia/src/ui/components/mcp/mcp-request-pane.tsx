import { type RJSFSchema } from '@rjsf/utils';
import type { EditorChange } from 'codemirror';
import React, { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Heading, Tab, TabList, TabPanel, Tabs, Toolbar } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useLatest } from 'react-use';

import { docsMcpClient } from '~/common/documentation';
import { buildResourceJsonSchema, fillUriTemplate } from '~/common/mcp-utils';
import type { McpReadyState } from '~/main/network/mcp';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { Link } from '~/ui/components/base/link';
import { EnvironmentKVEditor } from '~/ui/components/editors/environment-key-value-editor/key-value-editor';
import { Icon } from '~/ui/components/icon';
import { InsomniaRjsfForm, type InsomniaRjsfFormHandle } from '~/ui/components/rjsf';

import { type AuthTypes } from '../../../common/constants';
import type { Environment, EnvironmentKvPairData } from '../../../models/environment';
import { getAuthObjectOrNull } from '../../../network/authentication';
import {
  type McpRequestLoaderData,
  useRequestLoaderData,
} from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestPatcher, useRequestPayloadPatcher } from '../../hooks/use-request';
import { CodeEditor, type CodeEditorHandle } from '../.client/codemirror/code-editor';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { readOnlyHttpPairs, RequestHeadersEditor } from '../editors/request-headers-editor';
import { Pane } from '../panes/pane';
import { McpRootsPanel } from './mcp-roots-panel';
import { McpUrlActionBar } from './mcp-url-bar';
import type { PrimitiveSubItem } from './types';

const supportedAuthTypes: AuthTypes[] = ['basic', 'oauth2', 'bearer', 'apikey'];
export type RequestPaneTabs = 'params' | 'auth' | 'headers' | 'roots';

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
  readyState: McpReadyState;
  selectedPrimitiveItem?: PrimitiveSubItem | null;
  activeTab: RequestPaneTabs;
  onTabChange: (newTab: RequestPaneTabs) => void;
}

export const McpRequestPane: FC<Props> = ({
  environment,
  readyState,
  selectedPrimitiveItem,
  activeTab,
  onTabChange,
}) => {
  const primitiveId = `${selectedPrimitiveItem?.type}_${selectedPrimitiveItem?.name}`;
  const { activeRequest, activeRequestMeta, requestPayload } = useRequestLoaderData()! as McpRequestLoaderData;
  const [isCalling, setIsCalling] = useState(false);
  const latestRequestPayloadRef = useLatest(requestPayload);

  const { activeProject } = useWorkspaceLoaderData()!;

  const [mcpParams, setMcpParams] = useState<Record<string, any>>(requestPayload?.params || {});

  const paramEditorRef = useRef<CodeEditorHandle>(null);
  const rjsfFormRef = useRef<InsomniaRjsfFormHandle>(null);
  const requestId = activeRequest._id;
  const isStdio = activeRequest.transportType === 'stdio';

  const headersCount = activeRequest.headers.filter(h => !h.disabled).length + readOnlyHttpPairs.length;
  const patchRequest = useRequestPatcher();
  const mcpPayloadPatcher = useRequestPayloadPatcher();
  const latestPayloadPatcherRef = useLatest(mcpPayloadPatcher);

  const isConnected = readyState === 'connected';
  const isDisconnected = readyState === 'disconnected';

  // Reset the response pane state when we switch requests, the environment gets modified
  // Some of the UI(tokens) depends on the readyState, so we include it here as well
  const uniqueKey = `${environment?.modified}::${requestId}::${activeRequestMeta?.activeResponseId}::${readyState}`;
  const requestAuth = getAuthObjectOrNull(activeRequest.authentication);
  const isNoneOrInherited = requestAuth?.type === 'none' || requestAuth === null;
  const jsonSchema = useMemo(() => {
    if (selectedPrimitiveItem?.type === 'tools') {
      return selectedPrimitiveItem?.type === 'tools' ? (selectedPrimitiveItem.inputSchema as RJSFSchema) : undefined;
    } else if (selectedPrimitiveItem?.type === 'resources' || selectedPrimitiveItem?.type === 'resourceTemplates') {
      const res = buildResourceJsonSchema(selectedPrimitiveItem);
      return res;
    } else if (selectedPrimitiveItem?.type === 'prompts') {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      selectedPrimitiveItem?.arguments?.forEach(arg => {
        properties[arg.name] = {
          type: 'string',
          description: arg?.description || '',
        };
        if (arg.required) {
          required.push(arg.name);
        }
      });
      return {
        type: 'object',
        properties,
        required,
      } as RJSFSchema;
    }
    return {};
  }, [selectedPrimitiveItem]);

  const handleRjsfFormChange = useCallback(
    (formData: any) => {
      setMcpParams(prev => {
        return {
          ...prev,
          [primitiveId]: formData,
        };
      });
      if (selectedPrimitiveItem?.type !== 'resourceTemplates' && selectedPrimitiveItem?.type !== 'resources') {
        paramEditorRef.current?.setValue(JSON.stringify(formData || {}, null, 2));
      }
    },
    [primitiveId, selectedPrimitiveItem?.type],
  );

  const handleSend = async () => {
    rjsfFormRef.current?.validate();
    try {
      setIsCalling(true);
      if (selectedPrimitiveItem?.type === 'tools') {
        await window.main.mcp.primitive.callTool({
          name: selectedPrimitiveItem?.name || '',
          arguments: mcpParams[primitiveId],
          requestId: requestId,
        });
      } else if (selectedPrimitiveItem?.type === 'resources') {
        await window.main.mcp.primitive.readResource({
          requestId,
          uri: selectedPrimitiveItem?.uri || '',
        });
      } else if (selectedPrimitiveItem?.type === 'resourceTemplates') {
        await window.main.mcp.primitive.readResource({
          requestId,
          uri: fillUriTemplate(selectedPrimitiveItem.uriTemplate, mcpParams[primitiveId] || {}),
        });
      } else if (selectedPrimitiveItem?.type === 'prompts') {
        await window.main.mcp.primitive.getPrompt({
          requestId,
          name: selectedPrimitiveItem?.name || '',
          arguments: mcpParams[primitiveId],
        });
      }
    } catch (err) {
      console.warn('MCP primitive call error', err);
    } finally {
      setIsCalling(false);
    }
  };

  const handleEnvChange = (data: EnvironmentKvPairData[]) => {
    patchRequest(requestId, { env: data });
  };

  const handleEditorChange = (value: string, changeObj: EditorChange[]) => {
    try {
      const payload = JSON.parse(value);
      const origin = changeObj[0]?.origin;
      if (origin !== 'setValue') {
        setMcpParams(prev => {
          return {
            ...prev,
            [primitiveId]: payload,
          };
        });
      }
    } catch (err) {}
  };

  const sendButtonText = useMemo(() => {
    if (selectedPrimitiveItem?.type === 'tools') {
      return 'Call Tool';
    } else if (selectedPrimitiveItem?.type === 'resources' || selectedPrimitiveItem?.type === 'resourceTemplates') {
      return 'Read Resource';
    } else if (selectedPrimitiveItem?.type === 'prompts') {
      return 'Get Prompt';
    }
    return null;
  }, [selectedPrimitiveItem]);

  useEffect(() => {
    if (isConnected) {
      latestPayloadPatcherRef.current(requestId, { params: mcpParams, url: activeRequest.url });
    }
  }, [activeRequest.url, mcpParams, latestPayloadPatcherRef, requestId, isConnected]);

  useEffect(() => {
    if (isConnected) {
      setMcpParams(latestRequestPayloadRef.current?.params || {});
    }
  }, [activeRequest.url, latestRequestPayloadRef, isConnected]);

  return (
    <Pane type="request">
      <header className="pane__header theme--pane__header !items-stretch">
        <McpUrlActionBar
          key={uniqueKey}
          request={activeRequest}
          project={activeProject}
          environmentId={environment?._id || ''}
          defaultValue={activeRequest.url}
          readyState={readyState}
          onChange={url => patchRequest(requestId, { url })}
        />
      </header>
      <Tabs
        aria-label="Websocket request pane tabs"
        className="flex h-full w-full flex-1 flex-col"
        onSelectionChange={key => {
          const activeTab = key.toString();
          onTabChange(activeTab as RequestPaneTabs);
        }}
        selectedKey={activeTab}
      >
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
          {!isStdio && (
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
          )}
          {!isStdio && (
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
          )}
          {isStdio && (
            <Tab
              className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
              id="env"
            >
              <span>Environment</span>
            </Tab>
          )}
          <Tab
            className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
            id="roots"
          >
            <span>Roots</span>
            {activeRequest.roots.length > 0 && (
              <span className="flex h-6 min-w-6 items-center justify-center rounded-lg border border-solid border-[--hl] p-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          </Tab>
        </TabList>
        <TabPanel className="flex h-full w-full flex-1 flex-col overflow-y-auto" id="params">
          {!isConnected ? (
            <div className="flex h-full w-full flex-col items-center p-5 text-center">
              {/*  Hint when mcp server is not connected*/}
              <p className="notice info text-md no-margin-top w-full">
                Connect to an MCP server URL to reveal capabilities. &nbsp;<Link href={docsMcpClient}>Learn More</Link>
              </p>
            </div>
          ) : (
            <PanelGroup className="flex-1 overflow-hidden" direction={'vertical'}>
              <Panel minSize={20}>
                <div className="flex h-full flex-col">
                  <Toolbar className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center justify-between gap-2 px-2 py-2">
                    <Heading className="text-xs font-bold uppercase text-[--hl]">Parameter Builder</Heading>
                    {sendButtonText && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleSend}
                          className="rounded bg-[--color-surprise] px-[--padding-md] text-center text-[--color-font-surprise]"
                        >
                          {isCalling && <Icon className="mr-1 animate-spin" icon="spinner" />}
                          {sendButtonText}
                        </Button>
                      </div>
                    )}
                  </Toolbar>
                  {!selectedPrimitiveItem && (
                    <div className="flex h-full w-full flex-col items-center p-5 text-center">
                      <p className="notice info text-md no-margin-top w-full">
                        Select an MCP server primitive from the list to start.
                      </p>
                    </div>
                  )}
                  {jsonSchema && (
                    <div className="overflow-auto p-4">
                      <p>{selectedPrimitiveItem?.name}</p>
                      <p className="text-[--hl]">{selectedPrimitiveItem?.description}</p>
                      {selectedPrimitiveItem?.type === 'resourceTemplates' && (
                        <p className="py-2">
                          uri: {fillUriTemplate(selectedPrimitiveItem.uriTemplate, mcpParams[primitiveId] || {})}
                        </p>
                      )}
                      <div className="pl-2">
                        <InsomniaRjsfForm
                          formData={mcpParams[primitiveId]}
                          onChange={handleRjsfFormChange}
                          schema={jsonSchema}
                          ref={rjsfFormRef}
                          showErrorList={false}
                          focusOnFirstError
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
              <PanelResizeHandle className="h-[1px] w-full bg-[--hl-md]" />
              {selectedPrimitiveItem?.type !== 'resources' && selectedPrimitiveItem?.type !== 'resourceTemplates' && (
                <Panel minSize={20}>
                  <div className="flex h-full flex-col">
                    <Heading className="p-4 text-xs font-bold text-[--hl]">Parameter Overview</Heading>
                    <div className="flex-1 overflow-hidden">
                      <CodeEditor
                        ref={paramEditorRef}
                        id="mcp-parameter-overview-editor"
                        showPrettifyButton
                        dynamicHeight
                        uniquenessKey="mcp-parameter-overview-editor"
                        defaultValue={JSON.stringify(mcpParams[primitiveId] || {}, null, 2)}
                        onChange={handleEditorChange}
                        mode="json"
                        placeholder=""
                      />
                    </div>
                  </div>
                </Panel>
              )}
            </PanelGroup>
          )}
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="auth">
          {!isDisconnected && <PaneReadOnlyBanner />}
          <AuthWrapper
            key={uniqueKey}
            authentication={activeRequest.authentication}
            disabled={!isDisconnected}
            authTypes={supportedAuthTypes}
            hideInherit
            showMcpAuthFlow
            addToHeaderOnly
          />
        </TabPanel>
        <TabPanel className="w-full flex-1 overflow-y-auto" id="headers">
          {!isDisconnected && <PaneReadOnlyBanner />}
          <RequestHeadersEditor
            key={uniqueKey}
            headers={activeRequest.headers}
            bulk={false}
            isDisabled={!isDisconnected}
            requestType="McpRequest"
          />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="env">
          {!isDisconnected && <PaneReadOnlyBanner />}
          <EnvironmentKVEditor
            key={uniqueKey}
            data={activeRequest.env}
            disabled={!isDisconnected}
            textOnly
            onChange={handleEnvChange}
          />
        </TabPanel>
        <TabPanel className="flex w-full flex-1 flex-col overflow-hidden" id="roots">
          <McpRootsPanel request={activeRequest} readyState={readyState} />
        </TabPanel>
      </Tabs>
    </Pane>
  );
};
