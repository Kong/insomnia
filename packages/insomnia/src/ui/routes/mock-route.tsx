import deepEqual from 'deep-equal';
import React from 'react';
import { LoaderFunction, useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT, CONTENT_TYPE_XML, CONTENT_TYPE_YAML, contentTypesMap, getMockServiceURL, RESPONSE_CODE_REASONS } from '../../common/constants';
import { database as db } from '../../common/database';
import * as models from '../../models';
import { MockRoute } from '../../models/mock-route';
import { MockServer } from '../../models/mock-server';
import { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { PanelContainer, TabItem, Tabs } from '../components/base/tabs';
import { CodeEditor } from '../components/codemirror/code-editor';
import { MockResponseHeadersEditor, useMockRoutePatcher } from '../components/editors/mock-response-headers-editor';
import { MockResponsePane } from '../components/mocks/mock-response-pane';
import { formToHar, MockUrlBar } from '../components/mocks/mock-url-bar';
import { showAlert } from '../components/modals';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { SvgIcon } from '../components/svg-icon';

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
];

export const MockRouteRoute = () => {
  const { mockServer, mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const upsertBinOnRemoteFromResponse = async (compoundId: string | null): Promise<{ id: string; error?: string }> => {
    // send upsert and return id, or show alert modal with error
    try {
      const res = await window.main.axiosRequest({
        url: mockbinUrl + `/bin/upsert/${compoundId}`,
        method: 'put',
        data: formToHar({
          statusCode: mockRoute.statusCode,
          statusText: mockRoute.statusText,
          headersArray: mockRoute.headers,
          body: mockRoute.body,
        }),
      });
      if (res?.data?.errors) {
        console.error('error response', res?.data?.errors);
        return { id: '', error: res?.data?.errors };
      }
      if (res?.data?.length) {
        console.log('RES', res.data);
        return { id: res.data };
      }
      console.log('Error: invalid response from remote', { res, mockbinUrl });
      return { id: '', error: 'Invalid response from ' + mockbinUrl };
    } catch (e) {
      console.log(e);
      return { id: '', error: 'Unhandled error ' + e.message };
    }

  };

  const createandSendRequest = ({ url, method, parentId, binResponse }: { url: string; method: string; parentId: string; binResponse?: Partial<HarResponse> }) =>
    requestFetcher.submit(JSON.stringify({ url, method, parentId, binResponse }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });

  const upsertMockbinHar = async (pathInput?: string) => {
    // check for change and update remote
    const newResponse = formToHar({
      statusCode: mockRoute.statusCode,
      statusText: mockRoute.statusText,
      headersArray: mockRoute.headers,
      body: mockRoute.body,
    });
    const hasResponseChanged = !deepEqual(newResponse, mockRoute.binResponse);
    if (!hasResponseChanged) {
      console.log('response has not changed');
      return;
    }
    console.log('upserting mockbin har');
    const compoundId = mockRoute.parentId + pathInput;
    const { error } = await upsertBinOnRemoteFromResponse(compoundId);
    if (error) {
      showAlert({
        title: 'Network error',
        message: (
          <div>
            <p>The request failed due to a network error:</p>
            <code className="wide selectable">
              <pre>{error}</pre>
            </code>
          </div>
        ),
      });
      return;
    }
    patchMockRoute(mockRoute._id, {
      url: mockbinUrl + '/bin/' + mockRoute.parentId,
      path: pathInput,
      binResponse: newResponse,
    });
  };
  const onSend = async (pathInput: string) => {
    // on click send button, sync with remote and send hidden request
    await upsertMockbinHar(pathInput);
    const compoundId = mockRoute.parentId + pathInput;
    createandSendRequest({
      url: mockbinUrl + '/bin/' + compoundId,
      method: mockRoute.method,
      parentId: mockRoute._id,
      binResponse: formToHar({
        statusCode: mockRoute.statusCode,
        statusText: mockRoute.statusText,
        headersArray: mockRoute.headers,
        body: mockRoute.body,
      }),
    });
  };
  const onBlurTriggerUpsert = () => upsertMockbinHar(mockRoute.path);
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
                  {mockRoute.mimeType ? 'Response ' + contentTypesMap[mockRoute.mimeType]?.[0] : 'Response Body'}
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
                enableNunjucks
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
          <TabItem key="headers" title="Response Headers">
            <MockResponseHeadersEditor
              // TODO: update mock on blur if key is set
              bulk={false}
            />
          </TabItem>
          <TabItem key="status" title="Response Status">
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
