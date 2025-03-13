import { readFile } from 'fs/promises';
import React, { type FunctionComponent, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import { useMount } from 'react-use';

import { getCommonHeaderNames, getCommonHeaderValues } from '../../../common/common-headers';
import { database as db } from '../../../common/database';
import { generateId } from '../../../common/misc';
import { getRenderedGrpcRequest, getRenderedGrpcRequestMessage } from '../../../common/render';
import type { GrpcMethodType } from '../../../main/ipc/grpc';
import * as models from '../../../models';
import type { GrpcRequest, GrpcRequestHeader } from '../../../models/grpc-request';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { isRequestGroup, type RequestGroup } from '../../../models/request-group';
import { getOrInheritHeaders } from '../../../network/network';
import { urlMatchesCertHost } from '../../../network/url-matches-cert-host';
import { getGrpcConnectionErrorDetails } from '../../../utils/grpc';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { setDefaultProtocol } from '../../../utils/url/protocol';
import { useRequestPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import type { GrpcRequestState } from '../../routes/debug';
import type { GrpcRequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { GrpcSendButton } from '../buttons/grpc-send-button';
import { CodeEditor, type CodeEditorHandle } from '../codemirror/code-editor';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { GrpcMethodDropdown } from '../dropdowns/grpc-method-dropdown/grpc-method-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showAlert, showError, showModal } from '../modals';
import { ErrorModal } from '../modals/error-modal';
import { ProtoFilesModal } from '../modals/proto-files-modal';
import { RequestRenderErrorModal } from '../modals/request-render-error-modal';
import { Button } from '../themed-button';
import { Tooltip } from '../tooltip';
import { Pane, PaneBody, PaneHeader } from './pane';
interface Props {
  grpcState: GrpcRequestState;
  setGrpcState: (states: GrpcRequestState) => void;
  reloadRequests: (requestIds: string[]) => void;
}

export const canClientStream = (methodType?: GrpcMethodType) => methodType === 'client' || methodType === 'bidi';
export const GrpcMethodTypeName = {
  unary: 'Unary',
  server: 'Server Streaming',
  client: 'Client Streaming',
  bidi: 'Bi-directional Streaming',
} as const;

export const GrpcRequestPane: FunctionComponent<Props> = ({
  grpcState,
  setGrpcState,
  reloadRequests,
}) => {
  const { activeRequest } = useRouteLoaderData('request/:requestId') as GrpcRequestLoaderData;
  const {
    activeEnvironment,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const environmentId = activeEnvironment._id;
  const { settings } = useRootLoaderData();
  const [isProtoModalOpen, setIsProtoModalOpen] = useState(false);
  const { requestMessages, running, methods } = grpcState;
  useMount(async () => {
    if (activeRequest.protoFileId) {
      console.log(`[gRPC] loading proto file methods pf=${activeRequest.protoFileId}`);
      const methods = await window.main.grpc.loadMethods(activeRequest.protoFileId);
      setGrpcState({ ...grpcState, methods });
    } else if (activeRequest.url && activeRequest.reflectionApi) {
      const requestGroups = (await db.withAncestors<GrpcRequest | RequestGroup>(activeRequest, [models.requestGroup.type])).filter(isRequestGroup);
      const rendered =
        await tryToInterpolateRequestOrShowRenderErrorModal({
          request: activeRequest,
          environmentId,
          payload: {
            url: activeRequest.url,
            metadata: getOrInheritHeaders({ request: { headers: activeRequest.metadata }, requestGroups }),
            reflectionApi: activeRequest.reflectionApi,
          },
        });

      const workspaceClientCertificates = await models.clientCertificate.findByParentId(workspaceId);
      const clientCertificate = workspaceClientCertificates.find(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'grpc:'), rendered.url, false));
      const caCertificate = (await models.caCertificate.findByParentId(workspaceId));
      const caCertificatePath = caCertificate && !caCertificate.disabled ? caCertificate.path : undefined;
      const clientCert = clientCertificate?.cert ? await readFile(clientCertificate?.cert, 'utf8') : undefined;
      const clientKey = clientCertificate?.key ? await readFile(clientCertificate?.key, 'utf8') : undefined;

      const renderedWithCertificates = {
        ...rendered,
        rejectUnauthorized: settings.validateSSL,
        ...(activeRequest.url.toLowerCase().startsWith('grpcs:') ? {
          clientCert,
          clientKey,
          caCertificate: caCertificatePath ? await readFile(caCertificatePath, 'utf8') : undefined,
        } : {}),
      };
      const methods = await window.main.grpc.loadMethodsFromReflection(renderedWithCertificates);
      setGrpcState({ ...grpcState, methods });
    }
  });
  const editorRef = useRef<CodeEditorHandle>(null);
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const { workspaceId, requestId } = useParams() as { workspaceId: string; requestId: string };
  const patchRequest = useRequestPatcher();
  // Reset the response pane state when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniquenessKey = `${activeEnvironment.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}`;
  const method = methods.find(c => c.fullPath === activeRequest.protoMethodName);
  const methodType = method?.type;
  const handleRequestSend = async () => {
    if (method && !running) {
      try {
        const requestGroups = (await db.withAncestors<GrpcRequest | RequestGroup>(activeRequest, [models.requestGroup.type])).filter(isRequestGroup);
        const request = await getRenderedGrpcRequest({
          // split off the metadata from the request
          request: { ...activeRequest, metadata: getOrInheritHeaders({ request: { headers: activeRequest.metadata }, requestGroups }) },
          environment: environmentId,
          purpose: 'send',
          skipBody: canClientStream(methodType),
        });
        const workspaceClientCertificates = await models.clientCertificate.findByParentId(workspaceId);
        const clientCertificate = workspaceClientCertificates.find(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'grpc:'), request.url, false));
        const caCertificate = (await models.caCertificate.findByParentId(workspaceId));
        const caCertificatePath = caCertificate && !caCertificate.disabled ? caCertificate.path : undefined;
        window.main.grpc.start({
          request,
          rejectUnauthorized: settings.validateSSL,
          ...(request.url.toLowerCase().startsWith('grpcs:') ? {
            clientCert: clientCertificate?.cert ? await readFile(clientCertificate?.cert || '', 'utf8') : undefined,
            clientKey: clientCertificate?.key ? await readFile(clientCertificate?.key || '', 'utf8') : undefined,
            caCertificate: caCertificatePath ? await readFile(caCertificatePath, 'utf8') : undefined,
          } : {}),
       });
        setGrpcState({
          ...grpcState,
          requestMessages: [],
          responseMessages: [],
          status: undefined,
          error: undefined,
        });
      } catch (err) {
        if (err.type === 'render') {
          showModal(RequestRenderErrorModal, {
            request: activeRequest,
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

    }
  };

  useDocBodyKeyboardShortcuts({
    request_send: handleRequestSend,
  });

  const messageTabs = [{ id: 'body', name: 'Body', text: activeRequest.body.text }, ...requestMessages.sort((a, b) => a.created - b.created).map((msg, index) => ({ ...msg, name: `Stream ${index + 1}` }))];

  return (
    <>
      <Pane type="request">
        <PaneHeader>
          <div className="w-full h-full flex flex-row justify-between items-stretch">
            <div className="method-grpc pad-right pad-left vertically-center">gRPC</div>
            <div className='flex-1' title={activeRequest.url}>
              <OneLineEditor
                id="grpc-url"
                key={uniquenessKey}
                type="text"
                defaultValue={activeRequest.url}
                placeholder="grpcb.in:9000"
                onChange={url => patchRequest(requestId, { url })}
                getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, requestId)}
              />
            </div>
            <div className="flex-1 flex items-center pr-[--padding-sm] gap-[--padding-xs]">
              <GrpcMethodDropdown
                disabled={running}
                methods={methods}
                selectedMethod={method}
                handleChange={protoMethodName => {
                  patchRequest(requestId, { protoMethodName });
                  setGrpcState({
                    ...grpcState,
                    requestMessages: [],
                    responseMessages: [],
                    status: undefined,
                    error: undefined,
                  });
                }}
              />
              <Button
                variant="text"
                data-testid="button-use-request-stubs"
                disabled={!method?.example}
                onClick={() => {
                  if (editorRef.current && method?.example) {
                    editorRef.current.setValue(JSON.stringify(method.example, null, 2));
                  }
                }}
              >
                <Tooltip message="Click to replace body with an example" position="bottom" delay={500}>
                  <i className="fa fa-code" />
                </Tooltip>
              </Button>
              <Button
                variant="text"
                data-testid="button-server-reflection"
                disabled={!activeRequest.url}
                onClick={async () => {
                  try {
                    const requestGroups = (await db.withAncestors<GrpcRequest | RequestGroup>(activeRequest, [models.requestGroup.type])).filter(isRequestGroup);
                    let rendered =
                      await tryToInterpolateRequestOrShowRenderErrorModal({
                        request: activeRequest,
                        environmentId,
                        payload: {
                          url: activeRequest.url,
                          metadata: getOrInheritHeaders({ request: { headers: activeRequest.metadata }, requestGroups }),
                          reflectionApi: activeRequest.reflectionApi,
                        },
                      });
                    const workspaceClientCertificates = await models.clientCertificate.findByParentId(workspaceId);
                    const clientCertificate = workspaceClientCertificates.find(c => !c.disabled && urlMatchesCertHost(setDefaultProtocol(c.host, 'grpc:'), rendered.url, false));
                    const caCertificate = (await models.caCertificate.findByParentId(workspaceId));
                    const caCertificatePath = caCertificate && !caCertificate.disabled ? caCertificate.path : undefined;
                    const clientCert = clientCertificate?.cert ? await readFile(clientCertificate?.cert, 'utf8') : undefined;
                    const clientKey = clientCertificate?.key ? await readFile(clientCertificate?.key, 'utf8') : undefined;
                    rendered = {
                      ...rendered,
                      rejectUnauthorized: settings.validateSSL,
                      ...(activeRequest.url.toLowerCase().startsWith('grpcs:') ? {
                      clientCert,
                      clientKey,
                      caCertificate: caCertificatePath ? await readFile(caCertificatePath, 'utf8') : undefined,
                      } : {}),
                    };
                    const methods = await window.main.grpc.loadMethodsFromReflection(rendered);
                    setGrpcState({ ...grpcState, methods });
                    patchRequest(requestId, { protoFileId: '', protoMethodName: '' });
                  } catch (error) {
                    showModal(ErrorModal, { error, ...getGrpcConnectionErrorDetails(error) });
                  }
                }}
              >
                <Tooltip message="Click to use server reflection" position="bottom" delay={500}>
                  <i className="fa fa-refresh" />
                </Tooltip>
              </Button>
              <Button
                data-testid="button-proto-file"
                variant="text"
                onClick={() => setIsProtoModalOpen(true)}
              >
                <Tooltip message="Click to change proto file" position="bottom" delay={500}>
                  <i className="fa fa-file-code-o" />
                </Tooltip>
              </Button>
            </div>
            <div className='flex p-1'>
              <GrpcSendButton
                running={running}
                methodType={methodType}
                handleCancel={() => window.main.grpc.cancel(requestId)}
                handleStart={handleRequestSend}
              />
            </div>
          </div>
        </PaneHeader>
        <PaneBody>
            <Tabs aria-label='Grpc request pane tabs' className="flex-1 w-full h-full flex flex-col">
              <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
              {methodType && (
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='method-type'
                >
                  {GrpcMethodTypeName[methodType]}
                </Tab>
              )}
                <Tab className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300' id='headers'>
                  Headers
                </Tab>
              </TabList>
            {methodType && (
              <TabPanel className={'w-full h-full overflow-y-auto'} id='method-type'>
                <>
                  {running && canClientStream(methodType) && (
                    <div className="flex flex-row justify-end box-border h-[var(--line-height-sm)] border-b border-[var(--hl-lg)] p-1">
                      <button
                        className='btn btn--compact btn--clicky-small margin-left-sm bg-default'
                        onClick={async () => {
                          const requestBody = await getRenderedGrpcRequestMessage({
                            request: activeRequest,
                            environment: environmentId,
                            purpose: 'send',
                          });
                          const preparedMessage = {
                            body: requestBody,
                            requestId,
                          };
                          window.main.grpc.sendMessage(preparedMessage);
                          setGrpcState({
                            ...grpcState, requestMessages: [...requestMessages, {
                              id: generateId(),
                              text: preparedMessage.body.text || '',
                              created: Date.now(),
                            }],
                          });
                        }}
                      >
                        Stream <i className='fa fa-plus' />
                      </button>
                      <button
                        className='btn btn--compact btn--clicky-small margin-left-sm bg-surprise'
                        onClick={() => window.main.grpc.commit(requestId)}
                      >
                        Commit <i className='fa fa-arrow-right' />
                      </button>
                    </div>
                  )}
                  <Tabs key={uniquenessKey} aria-label="Grpc tabbed messages tabs" className="flex-1 w-full h-full flex flex-col">
                    <TabList items={messageTabs} className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]'>
                      {item => (
                        <Tab
                          className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                          id={item.id}
                        >
                          {item.name}
                        </Tab>
                      )}
                    </TabList>
                    <TabPanel id="body" className='w-full h-full overflow-y-auto'>
                      <CodeEditor
                        id="grpc-request-editor"
                        ref={editorRef}
                        defaultValue={activeRequest.body.text}
                        onChange={text => patchRequest(requestId, { body: { text } })}
                        mode="application/json"
                        enableNunjucks
                        showPrettifyButton={true}
                      />
                    </TabPanel>
                    {messageTabs.filter(msg => msg.id !== 'body').map(m => (
                      <TabPanel key={m.id} id={m.id} className='w-full h-full overflow-y-auto'>
                        <CodeEditor
                          id={'grpc-request-editor-tab' + m.id}
                          defaultValue={m.text}
                          mode="application/json"
                          enableNunjucks
                          readOnly
                          autoPrettify
                        />
                      </TabPanel>
                    ))}
                  </Tabs>
                </>
              </TabPanel>
            )}
              <TabPanel className={'w-full h-full overflow-y-auto'} id='headers'>
                <ErrorBoundary key={uniquenessKey} errorClassName="font-error pad text-center">
                  <KeyValueEditor
                    namePlaceholder="header"
                    valuePlaceholder="value"
                    descriptionPlaceholder="description"
                    pairs={activeRequest.metadata}
                    isDisabled={running}
                    handleGetAutocompleteNameConstants={getCommonHeaderNames}
                    handleGetAutocompleteValueConstants={getCommonHeaderValues}
                    onChange={(metadata: GrpcRequestHeader[]) => patchRequest(requestId, { metadata })}
                  />
                </ErrorBoundary>
              </TabPanel>
          </Tabs>
        </PaneBody>
      </Pane>
      {isProtoModalOpen && <ProtoFilesModal
        reloadRequests={reloadRequests}
        defaultId={activeRequest.protoFileId}
        onHide={() => setIsProtoModalOpen(false)}
        onSave={async (protoFileId: string) => {
          if (!protoFileId) {
            patchRequest(requestId, { protoFileId: '', protoMethodName: '' });
            setGrpcState({ ...grpcState, methods: [] });
            setIsProtoModalOpen(false);
          } else {
            try {
              const methods = await window.main.grpc.loadMethods(protoFileId);
              patchRequest(requestId, { protoFileId, protoMethodName: '' });
              setGrpcState({ ...grpcState, methods });
              setIsProtoModalOpen(false);
            } catch (error) {
              showError({
                title: 'Invalid Proto File',
                message: 'The proto file could not be parsed',
                error,
              });
            }
          }
        }}
      />}
    </>
  );
};
