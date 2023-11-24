import React from 'react';
import { LoaderFunction, useRouteLoaderData } from 'react-router-dom';

import { contentTypesMap } from '../../common/constants';
import { database as db } from '../../common/database';
import * as models from '../../models';
import { MockRoute } from '../../models/mock-route';
import { Response } from '../../models/response';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { TabItem, Tabs } from '../components/base/tabs';
import { CodeEditor } from '../components/codemirror/code-editor';
import { MockResponseHeadersEditor, useMockRoutePatcher } from '../components/editors/mock-response-headers-editor';
import { MockResponsePane } from '../components/mocks/mock-response-pane';
import { MockUrlBar } from '../components/mocks/mock-url-bar';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { SvgIcon } from '../components/svg-icon';

export interface MockRouteLoaderData {
  mockRoute: MockRoute;
  activeResponse?: Response;
}

export const loader: LoaderFunction = async ({ params }): Promise<MockRouteLoaderData> => {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(mockRouteId, 'Mock route ID is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');
  // get current response via request children of
  const reqIds = (await models.request.findByParentId(mockRouteId)).map(r => r._id);

  const responses = await db.findMostRecentlyModified<Response>(models.response.type, { parentId: { $in: reqIds } });
  return {
    mockRoute,
    activeResponse: responses?.[0],
  };
};

const mockContentTypes = [
  'application/json',
  'application/xml',
];
export const MockRouteRoute = () => {
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  return (
    <Pane type="request">
      <PaneHeader>
        <MockUrlBar />
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
              bulk={false}
            />
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
