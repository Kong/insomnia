import type * as Har from 'har-format';
import { isApiError, upsertMockbin } from 'insomnia-api';
import { useCallback } from 'react';
import { Button, Tab, TabList, TabPanel, Tabs, Toolbar } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router';

import {
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_OTHER,
  CONTENT_TYPE_PLAINTEXT,
  CONTENT_TYPE_XML,
  CONTENT_TYPE_YAML,
  contentTypesMap,
  getMockServiceBinURL,
  getMockServiceURL,
  RESPONSE_CODE_REASONS,
} from '~/common/constants';
import { database as db } from '~/common/database';
import { getResponseCookiesFromHeaders } from '~/common/har';
import * as models from '~/models';
import { getBodyBuffer } from '~/models/helpers/response-operations';
import type { MockRoute } from '~/models/mock-route';
import type { MockServer } from '~/models/mock-server';
import type { Request, RequestHeader } from '~/models/request';
import type { Response } from '~/models/response';
import { useRootLoaderData } from '~/root';
import { useRequestNewMockSendActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new-mock-send';
import { useMockRouteUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update';
import { SegmentEvent } from '~/ui/analytics';
import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';
import { Dropdown, DropdownItem, ItemContent } from '~/ui/components/base/dropdown';
import { MockResponseHeadersEditor } from '~/ui/components/editors/mock-response-headers-editor';
import { MockResponsePane } from '~/ui/components/mocks/mock-response-pane';
import { MockUrlBar } from '~/ui/components/mocks/mock-url-bar';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { EmptyStatePane } from '~/ui/components/panes/empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { SvgIcon } from '~/ui/components/svg-icon';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

export interface MockRouteLoaderData {
  mockServer: MockServer;
  mockRoute: MockRoute;
  activeResponse?: Response;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { workspaceId, mockRouteId } = params;

  const mockServer = await models.mockServer.getByParentId(workspaceId);
  invariant(mockServer, 'Mock server is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');
  // get current response via request children of
  // TODO: use the same request for try mock rather than creating lots of child requests
  const reqIds = (await models.request.findByParentId(mockRouteId)).map(r => r._id);

  const activeResponse = await db.findOne<Response>(
    models.response.type,
    { parentId: { $in: reqIds } },
    { modified: -1 },
  );
  if (activeResponse && 'bodyPath' in activeResponse) {
    // read the body if its smaller than the limit add it to the activeResponse
    const length = Math.max(activeResponse.bytesContent, activeResponse.bytesRead);
    const isOversizedResponse = length > 5 * 1024 * 1024; // 5MB
    // Oversized responses are handled in the response-viewer.tsx for now
    if (!isOversizedResponse) {
      const buffer = await getBodyBuffer(activeResponse);
      activeResponse.bodyBuffer = typeof buffer === 'string' ? Buffer.from(buffer) : buffer;
    }
  }
  return {
    mockServer,
    mockRoute,
    activeResponse,
  };
}

const mockContentTypes = [
  CONTENT_TYPE_PLAINTEXT,
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_XML,
  CONTENT_TYPE_YAML,
  CONTENT_TYPE_OTHER,
];
export const isInMockContentTypeList = (contentType: string): boolean =>
  Boolean(contentType && mockContentTypes.includes(contentType));

// mockbin expect a HAR response structure
export const mockRouteToHar = ({
  statusCode,
  statusText,
  mimeType,
  headersArray,
  body,
}: {
  statusCode: number;
  statusText: string;
  mimeType: string;
  headersArray: RequestHeader[];
  body: string;
}): Har.Response => {
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
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { submit } = useMockRouteUpdateActionFetcher();
  return useCallback(
    (id: string, patch: Partial<MockRoute>) => {
      submit({
        mockRouteId: id,
        organizationId,
        projectId,
        workspaceId,
        patch,
      });
    },
    [organizationId, projectId, submit, workspaceId],
  );
};

export function useMockRouteLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId',
  );
}

export const MockRouteRoute = () => {
  const { mockServer, mockRoute } = useMockRouteLoaderData()!;

  const { userSession } = useRootLoaderData()!;
  const patchMockRoute = useMockRoutePatcher();
  const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

  const requestFetcher = useRequestNewMockSendActionFetcher({ key: 'mock-request-fetcher' });
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const upsertBinOnRemoteFromResponse = async (compoundId: string): Promise<string> => {
    try {
      const res = await upsertMockbin({
        mockbinUrl,
        compoundId,
        organizationId,
        sessionId: userSession.id,
        method: mockRoute.method,
        data: mockRouteToHar({
          statusCode: mockRoute.statusCode,
          statusText: mockRoute.statusText,
          headersArray: mockRoute.headers,
          mimeType: mockRoute.mimeType,
          body: mockRoute.body,
        }),
      });

      if (typeof res === 'string') {
        return '';
      }
      console.log('[mock] Error: invalid response from remote', { res, mockbinUrl });
      return 'Unexpected response, see console for details';
    } catch (e) {
      if (isApiError(e)) {
        console.error('error response', e);
        return `Mock API ${e.name}:\n${e.message}`;
      }
      const errorMessage = e instanceof Error ? e.message : String(e);
      return `Unhandled contacting Mock API at ${mockbinUrl}\n${errorMessage}`;
    }
  };

  const createAndSendPrivateRequest = (patch: Partial<Request>) =>
    requestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      patch,
    });
  const upsertMockbinHar = async (pathInput?: string) => {
    const compoundId = mockRoute.parentId + pathInput;
    const error = await upsertBinOnRemoteFromResponse(compoundId);
    if (error) {
      showModal(AlertModal, {
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
  };
  const onSend = async (pathInput: string) => {
    await upsertMockbinHar(pathInput);
    createAndSendPrivateRequest({
      url: getMockServiceBinURL(mockServer, pathInput),
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
        <MockUrlBar key={mockRoute._id + mockRoute.name} onSend={onSend} />
      </PaneHeader>
      <PaneBody>
        <Tabs aria-label="Mock response config" className="flex h-full w-full flex-1 flex-col">
          <TabList
            className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
            aria-label="Request pane tabs"
          >
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="content-type"
            >
              Mock Body
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="headers"
            >
              Mock Headers{' '}
              {headersCount > 0 && (
                <span className="color-inherit flex aspect-square items-center justify-between overflow-hidden rounded-lg border border-solid border-(--hl-md) p-2 text-xs">
                  {headersCount}
                </span>
              )}
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="status"
            >
              Mock Status
            </Tab>
          </TabList>
          <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="content-type">
            <Toolbar className="flex h-(--line-height-sm) w-full shrink-0 items-center border-b border-solid border-(--hl-md) px-2">
              <Dropdown
                aria-label="Change Body Type"
                triggerButton={
                  <Button>
                    {mockRoute.mimeType ? 'Mock ' + contentTypesMap[mockRoute.mimeType]?.[0] : 'Mock Body'}
                    <i className="fa fa-caret-down space-left" />
                  </Button>
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
            </Toolbar>
            {mockRoute.mimeType ? (
              <CodeEditor
                id="mock-response-body-editor"
                key={mockRoute._id}
                showPrettifyButton
                defaultValue={mockRoute.body}
                onChange={body => patchMockRoute(mockRoute._id, { body })}
                onBlur={onBlurTriggerUpsert}
                mode={mockRoute.mimeType}
                placeholder="..."
                noLint={mockRoute.body?.includes('{{') && mockRoute.body?.includes('}}')}
                updateFilter={filter => {
                  if (filter) {
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.filterCreatedResponseBody,
                    });
                  }
                }}
              />
            ) : (
              <EmptyStatePane
                icon={<SvgIcon icon="bug" />}
                documentationLinks={[]}
                secondaryAction="Set up the mock body and headers you would like to return"
                title="Choose a mock body to return as a response"
              />
            )}
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="headers">
            <MockResponseHeadersEditor key={mockRoute._id + mockRoute.name} onBlur={onBlurTriggerUpsert} bulk={false} />
          </TabPanel>
          <TabPanel className="flex w-full flex-1 flex-col overflow-y-auto" id="status">
            <div className="w-full px-4">
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label htmlFor="mock-response-status-code-editor">
                    <small>Status Code</small>
                    <input
                      key={mockRoute._id + mockRoute.name}
                      id="mock-response-status-code-editor"
                      type="number"
                      defaultValue={mockRoute.statusCode}
                      onChange={e =>
                        patchMockRoute(mockRoute._id, { statusCode: Number.parseInt(e.currentTarget.value, 10) })
                      }
                      onBlur={onBlurTriggerUpsert}
                      placeholder="200"
                    />
                  </label>
                </div>
              </div>
              <div className="form-row">
                <div className="form-control form-control--outlined">
                  <label htmlFor="mock-response-status-text-editor">
                    <small>Status Text</small>
                    <input
                      key={mockRoute._id + mockRoute.name}
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
            </div>
          </TabPanel>
        </Tabs>
      </PaneBody>
    </Pane>
  );
};

export const MockRouteResponse = () => {
  return <MockResponsePane />;
};
