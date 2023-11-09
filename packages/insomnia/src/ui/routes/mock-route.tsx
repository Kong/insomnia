import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { LoaderFunction, useLoaderData, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { contentTypesMap, HTTP_METHODS } from '../../common/constants';
import { MockRoute } from '../../models/mock-route';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { TabItem, Tabs } from '../components/base/tabs';
import { CodeEditor } from '../components/codemirror/code-editor';
import { OneLineEditor } from '../components/codemirror/one-line-editor';
import { MockResponseHeadersEditor } from '../components/editors/mock-response-headers-editor';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';

export interface MockRouteLoaderData {
  mockRoute: MockRoute;
}

export const loader: LoaderFunction = async ({
  request,
  params,
}): Promise<MockRouteLoaderData> => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  return {
    mockRoute: { headers: [] },
  };
};
const StyledUrlBar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
`;

const StyledUrlEditor = styled.div`
  flex: 1;
`;

const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});

const mockContentTypes = [
  'application/json',
  'application/xml',
];
export const MockRouteRoute = () => {
  const mockUrl = 'url goes here?';
  const method = 'GET';
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  // const { mockRoute } = useLoaderData() as MockRouteLoaderData;
  console.log({ mockRoute });
  const [selectedContentType, setContentType] = useState('');
  return (
    <Pane type="request">
      <PaneHeader>
        <StyledUrlBar>
          <Dropdown
            className="method-dropdown"
            triggerButton={
              <StyledDropdownButton className={'pad-right pad-left vertically-center'}>
                <span className={`http-method-${method}`}>{method}</span>{' '}
                <i className="fa fa-caret-down space-left" />
              </StyledDropdownButton>
            }
          >{HTTP_METHODS.map(method => (
            <DropdownItem key={method}>
              <ItemContent
                className={`http-method-${method}`}
                label={method}
              // onClick={() => onChange(method)}
              />
            </DropdownItem>
          ))}
          </Dropdown>
          <StyledUrlEditor title={mockUrl}>
            <OneLineEditor
              id="grpc-url"
              type="text"
              defaultValue={mockUrl}
              placeholder="something"
            // onChange={url => patchRequest(requestId, { url })}
            // getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, requestId)}
            />
          </StyledUrlEditor>
          <div className='flex p-1'>
            <Button>Test</Button>
          </div>
        </StyledUrlBar>
      </PaneHeader>
      <PaneBody>
        <Tabs aria-label="Mock response config">
          <TabItem
            key="content-type"
            title={<Dropdown
              aria-label='Change Body Type'
              triggerButton={
                <DropdownButton>
                  {selectedContentType ? contentTypesMap[selectedContentType]?.[0] : 'Mock Body'}
                  <i className="fa fa-caret-down space-left" />
                </DropdownButton>
              }
            >
              {mockContentTypes.map(contentType => (
                <DropdownItem key={contentType}>
                  <ItemContent
                    label={contentTypesMap[contentType]?.[1]}
                    onClick={() => setContentType(contentType)}
                  />
                </DropdownItem>
              ))}
            </Dropdown>
            }
          >
            <CodeEditor
              id="raw-editor"
              showPrettifyButton
              // defaultValue={content}
              // className={className}
              enableNunjucks
              // onChange={onChange}
              mode={selectedContentType}
              placeholder="..."
            />
          </TabItem>
          <TabItem key="headers" title="Mock Headers">
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
  return (<Pane type="response">
    <PaneBody>
      <Tabs aria-label="Mock response">
        <TabItem key="history" title="History">
          history
        </TabItem>
        <TabItem key="preview" title="Preview">
          preview
        </TabItem>
        <TabItem key="headers" title="Headers">
          headers
        </TabItem>
        <TabItem key="timeline" title="Timeline">
          timeline
        </TabItem>
      </Tabs>
    </PaneBody>
  </Pane>);
};
