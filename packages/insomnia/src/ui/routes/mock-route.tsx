import { AxiosResponse } from 'axios';
import React from 'react';
import { Button } from 'react-aria-components';
import { LoaderFunction, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, RESPONSE_CODE_REASONS } from '../../common/constants';
import { contentTypesMap, HTTP_METHODS } from '../../common/constants';
import * as models from '../../models';
import { MockbinInput, MockRoute } from '../../models/mock-route';
import { RequestHeader } from '../../models/request';
import { invariant } from '../../utils/invariant';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../components/base/dropdown';
import { TabItem, Tabs } from '../components/base/tabs';
import { CodeEditor } from '../components/codemirror/code-editor';
import { MockResponseHeadersEditor, useMockRoutePatcher } from '../components/editors/mock-response-headers-editor';
import { MockResponsePane } from '../components/mocks/mock-response-pane';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { SvgIcon } from '../components/svg-icon';

const mockbinUrl = 'http://localhost:8080';

export interface MockRouteLoaderData {
  mockRoute: MockRoute;
}

export const loader: LoaderFunction = async ({ params }): Promise<MockRouteLoaderData> => {
  const { organizationId, projectId, workspaceId, mockRouteId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  invariant(mockRouteId, 'Mock route ID is required');
  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');

  return {
    mockRoute,
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

  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  console.log(mockRoute._id, { mockRoute });
  const patchMockRoute = useMockRoutePatcher();
  const formToMockBin = async ({ statusCode, headersArray, body }: { statusCode: number; headersArray: RequestHeader[]; body: string }) => {
  // const headersArray = headers.split(/\r?\n|\r/g).map(l => l.split(/:\s(.+)/))
  //   .filter(([n]) => !!n)
  //   .map(([name, value = '']) => ({ name, value }));
    const contentType = headersArray.find(h => h.name.toLowerCase() === 'content-type')?.value || CONTENT_TYPE_PLAINTEXT;
    console.log({ headersArray });
    return {
      'status': +statusCode,
      'statusText': RESPONSE_CODE_REASONS[+statusCode] || '',
      'httpVersion': 'HTTP/1.1',
      'headers': headersArray,
      // NOTE: cookies are sent as headers by insomnia
      'cookies': [],
      'content': {
        'size': Buffer.byteLength(body),
        'mimeType': contentType,
        'text': body,
        'compression': 0,
      },
      'bodySize': 0,
    };
  };
  const createBinOnRemoteFromResponse = async (mockbinInput: MockbinInput): Promise<string> => {
    console.log({ mockbinInput });
    try {
      const bin = await window.main.axiosRequest({
        url: mockbinUrl + '/bin/create',
        method: 'post',
        data: mockbinInput,
      });
      // todo: show bin logs
      // todo: handle error better
      // todo create/update current bin url
      console.log({ bin });
      if (bin?.data) {
        return bin.data;
      }
    } catch (e) {
      console.log(e);
    }
    console.log('Error: creating bin on remote');
    return '';

  };
  return (
    <Pane type="request">
      <PaneHeader>
        <StyledUrlBar>
          <Dropdown
            className="method-dropdown"
            triggerButton={
              <StyledDropdownButton className={'pad-right pad-left vertically-center'}>
                <span className={`http-method-${mockRoute.method}`}>{mockRoute.method}</span>{' '}
                <i className="fa fa-caret-down space-left" />
              </StyledDropdownButton>
            }
          >{HTTP_METHODS.map(method => (
            <DropdownItem key={method}>
              <ItemContent
                className={`http-method-${method}`}
                label={method}
                onClick={() => patchMockRoute(mockRoute._id, { method })}
              />
            </DropdownItem>
          ))}
          </Dropdown>
          <div className='flex p-1'>
            {mockRoute.path}
            {/* <OneLineEditor
              id="grpc-url"
              type="text"
              defaultValue={mockRoute.path}
              placeholder="something"
            // onChange={url => patchRequest(requestId, { url })}
            // getAutocompleteConstants={() => queryAllWorkspaceUrls(workspaceId, models.grpcRequest.type, requestId)}
            /> */}
          </div>
          <div className='flex p-1'>
            <Button
              className="urlbar__send-btn"
              onPress={async () => {
                console.log('test', mockRoute);
                const bin = await formToMockBin({
                  statusCode: 200,
                  headersArray: mockRoute.headers,
                  body: mockRoute.body,
                });
                const id = await createBinOnRemoteFromResponse(bin);
                const url = mockbinUrl + '/bin/' + id;
                console.log('test', url);
                // inputRef.current?.setValue(url);
                patchMockRoute(mockRoute._id, { path: url, bins: [...mockRoute.bins, { binId: id, ...bin }] });
                // create bin
                // send to bin
              }}
            >Test</Button>
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
                  {mockRoute.mimeType ? contentTypesMap[mockRoute.mimeType]?.[0] : 'Mock Body'}
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
                id="raw-editor"
                // todo fix route toggle
                showPrettifyButton
                defaultValue={mockRoute.body}
                // className={className}
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
  return (
    <MockResponsePane />
  );
};
