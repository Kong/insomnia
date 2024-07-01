import * as Har from 'har-format';
import React from 'react';
import { LoaderFunction, useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_OTHER, CONTENT_TYPE_PLAINTEXT, CONTENT_TYPE_XML, CONTENT_TYPE_YAML, contentTypesMap, getMockServiceURL, RESPONSE_CODE_REASONS } from '../../common/constants';
import { database as db } from '../../common/database';
import { getResponseCookiesFromHeaders } from '../../common/har';
import * as models from '../../models';
import { MockRoute } from '../../models/mock-route';
import { MockServer } from '../../models/mock-server';
import { Request, RequestHeader } from '../../models/request';
import { Response } from '../../models/response';
import { insomniaFetch } from '../../ui/insomniaFetch';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { PanelContainer, TabItem, Tabs } from '../components/base/tabs';
import { CodeEditor } from '../components/codemirror/code-editor';
import { MockResponseHeadersEditor } from '../components/editors/mock-response-headers-editor';
import { MockResponsePane } from '../components/mocks/mock-response-pane';
import { MockUrlBar } from '../components/mocks/mock-url-bar';
import { showAlert, showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { SvgIcon } from '../components/svg-icon';
import { MockServerLoaderData } from './mock-server';
import { useRootLoaderData } from './root';

export interface MockRouteLoaderData {
  mockServer: MockServer;
  mockRoute: MockRoute;
  activeResponse?: Response;
}

export const loader: LoaderFunction = async ({ params }): Promise<MockRouteLoaderData> => {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(mockRouteId, 'Mock route ID is required');
  const mockServer = await models.mockServer.getByParentId(workspaceId);
  invariant(mockServer, 'Mock server is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');
  // get current response via request children of
  // TODO: use the same request for try mock rather than creating lots of child requests
  const reqIds = (await models.request.findByParentId(mockRouteId)).map(r => r._id);

  const responses = await db.findMostRecentlyModified<Response>(models.response.type, { parentId: { $in: reqIds } });
  return {
    mockServer,
    mockRoute,
    activeResponse: responses?.[0],
  };
};

const mockContentTypes = [
  CONTENT_TYPE_PLAINTEXT,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_XML,
  CONTENT_TYPE_YAML,
  CONTENT_TYPE_OTHER,
];
export const isInMockContentTypeList = (contentType: string): boolean => Boolean(contentType && mockContentTypes.includes(contentType));

// mockbin expect a HAR response structure
export const mockRouteToHar = ({ statusCode, statusText, mimeType, headersArray, body }: { statusCode: number; statusText: string; mimeType: string; headersArray: RequestHeader[]; body: string }): Har.Response => {
  const validHeaders = headersArray.filter(({ name }) => !!name);
  return {
    status: +statusCode,
    statusText: statusText || RESPONSE_CODE_REASONS[+statusCode] || '',
    httpVersion: 'HTTP/1.1',
    headers: validHeaders,
    cookies: getResponseCookiesFromHeaders(validHeaders),
    content: {
      size: Buffer.byteLength(body),
      mimeType,
      text: body,
      compression: 0,
    },
    headersSize: -1,
    bodySize: -1,
    redirectURL: '',
  };
};
export const useMockRoutePatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const fetcher = useFetcher();
  return (id: string, patch: Partial<MockRoute>) => {
    fetcher.submit(JSON.stringify(patch), {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${id}/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
};

export const MockRouteRoute = () => {
  const { mockServer, mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const { mockRoutes } = useRouteLoaderData('mock-server') as MockServerLoaderData;

  const { userSession } = useRootLoaderData();
  const patchMockRoute = useMockRoutePatcher();
  const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

  const requestFetcher = useFetcher({ key: 'mock-request-fetcher' });
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const upsertBinOnRemoteFromResponse = async (compoundId: string | null): Promise<string> => {
    try {
      const res = await insomniaFetch<string | {
        error: string;
        message: string;
      }>({
        origin: mockbinUrl,
        path: `/bin/upsert/${compoundId}`,
        method: 'PUT',
        organizationId,
        sessionId: userSession.id,
        data: mockRouteToHar({
          statusCode: mockRoute.statusCode,
          statusText: mockRoute.statusText,
          headersArray: mockRoute.headers,
          mimeType: mockRoute.mimeType,
          body: mockRoute.body,
        }),
      });
      if (typeof res === 'object' && 'message' in res && 'error' in res) {
        console.error('error response', res);
        return `Mock API ${res.error}:\n${res.message}`;
      }

      if (typeof res === 'string') {
        return '';
      }
      console.log('[mock] Error: invalid response from remote', { res, mockbinUrl });
      return 'Unexpected response, see console for details';
    } catch (e) {
      console.log(e);
      return `Unhandled contacting Mock API at ${mockbinUrl}\n${e.message}`;
    }
  };

  const createandSendPrivateRequest = (patch: Partial<Request>) =>
    requestFetcher.submit(JSON.stringify(patch),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });

  const upsertMockbinHar = async (pathInput?: string) => {
    const hasRouteInServer = mockRoutes.filter(m => m._id !== mockRoute._id).find(m => m.name === pathInput);
    if (hasRouteInServer) {
      showModal(AlertModal, {
        title: 'Error',
        message: `Path "${pathInput}" must be unique. Please enter a different name.`,
      });
      return;
    };
    if (pathInput?.[0] !== '/') {
      showModal(AlertModal, {
        title: 'Error',
        message: 'Path must begin with a /',
      });
      return;
    };
    const compoundId = mockRoute.parentId + pathInput;
    const error = await upsertBinOnRemoteFromResponse(compoundId);
    if (error) {
      showAlert({
        title: 'Network error',
        message: (
          <div>
            <pre className="pad-top-sm force-wrap selectable">
              <code className="wide">{error}</code>
            </pre>
          </div>
        ),
      });
      return;
    }
    patchMockRoute(mockRoute._id, {
      name: pathInput,
    });
  };
  const onSend = async (pathInput: string) => {
    const hasRouteInServer = mockRoutes.filter(m => m._id !== mockRoute._id).find(m => m.name === pathInput);
    if (hasRouteInServer) {
      showModal(AlertModal, {
        title: 'Error',
        message: `Path "${pathInput}" must be unique. Please enter a different name.`,
      });
      return;
    };
    if (pathInput[0] !== '/') {
      showModal(AlertModal, {
        title: 'Error',
        message: 'Path must begin with a /',
      });
      return;
    };
    await upsertMockbinHar(pathInput);
    const compoundId = mockRoute.parentId + pathInput;
    createandSendPrivateRequest({
      url: mockbinUrl + '/bin/' + compoundId,
      method: mockRoute.method,
      headers: mockRoute.headers,
      parentId: mockRoute._id,
    });
  };
  const onBlurTriggerUpsert = () => upsertMockbinHar(mockRoute.name);
  const headersCount = mockRoute.headers.filter(h => !h.disabled).length;

  return (
    <Pane type="request">
      <PaneHeader>
        <MockUrlBar key={mockRoute._id + mockRoute.name} onSend={onSend} onPathUpdate={upsertMockbinHar} />
      </PaneHeader>
      <PaneBody>
        <Tabs aria-label="Mock response config">
          <TabItem
            key="content-type"
            title={<Dropdown
              aria-label='Change Body Type'
              triggerButton={
                <DropdownButton>
                  {mockRoute.mimeType ? 'Mock ' + contentTypesMap[mockRoute.mimeType]?.[0] : 'Mock Body'}
                  <i className="fa fa-caret-down space-left" />
                </DropdownButton>
              }
            >
              {mockContentTypes.map(contentType => (
                <DropdownItem key={contentType}>
                  <ItemContent
                    label={contentTypesMap[contentType]?.[1]}
                    onClick={() => patchMockRoute(mockRoute._id, { mimeType: contentType })}
                  />
                </DropdownItem>
              ))}
            </Dropdown>
            }
          >
            {mockRoute.mimeType ?
              (<CodeEditor
                id="mock-response-body-editor"
                key={mockRoute._id}
                showPrettifyButton
                defaultValue={mockRoute.body}
                onChange={body => patchMockRoute(mockRoute._id, { body })}
                onBlur={onBlurTriggerUpsert}
                mode={mockRoute.mimeType}
                placeholder="..."
              />) :
              (<EmptyStatePane
                icon={<SvgIcon icon="bug" />}
                documentationLinks={[]}
                secondaryAction="Set up the mock body and headers you would like to return"
                title="Choose a mock body to return as a response"
              />)}
          </TabItem>
          <TabItem
            key="headers"
            title={<div className='flex items-center gap-2'>
              Mock Headers{' '}
              {headersCount > 0 && (
                <span className="p-2 aspect-square flex items-center color-inherit justify-between border-solid border border-[--hl-md] overflow-hidden rounded-lg text-xs shadow-small">{headersCount}</span>
              )}
            </div>}
          >
            <MockResponseHeadersEditor
              onBlur={onBlurTriggerUpsert}
              bulk={false}
            />
          </TabItem>
          <TabItem key="status" title="Mock Status">
            <PanelContainer className="pad">
              <div className="form-row">
                <div className='form-control form-control--outlined'>
                  <label htmlFor="mock-response-status-code-editor">
                    <small>Status Code</small>
                    <input
                      id="mock-response-status-code-editor"
                      type="number"
                      defaultValue={mockRoute.statusCode}
                      onChange={e => patchMockRoute(mockRoute._id, { statusCode: parseInt(e.currentTarget.value, 10) })}
                      onBlur={onBlurTriggerUpsert}
                      placeholder="200"
                    />
                  </label>
                </div>
              </div>
              <div className="form-row">
                <div className='form-control form-control--outlined'>
                  <label htmlFor="mock-response-status-text-editor">
                    <small>Status Text</small>
                    <input
                      id="mock-response-status-text-editor"
                      type="string"
                      defaultValue={mockRoute.statusText}
                      onChange={e => patchMockRoute(mockRoute._id, { statusText: e.currentTarget.value })}
                      onBlur={onBlurTriggerUpsert}

                      placeholder={RESPONSE_CODE_REASONS[mockRoute.statusCode || 200] || 'Unknown'}
                    />
                  </label>
                </div>
              </div>
            </PanelContainer>
          </TabItem>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};

export const MockRouteResponse = () => {
  return (
    <MockResponsePane />
  );
};
