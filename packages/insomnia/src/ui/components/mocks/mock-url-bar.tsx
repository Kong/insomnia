import React from 'react';
import { Button } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { MockbinInput } from '../../../models/mock-route';
import { RequestHeader } from '../../../models/request';
import { invariant } from '../../../utils/invariant';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { useMockRoutePatcher } from '../editors/mock-response-headers-editor';
const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});

const mockbinUrl = 'http://localhost:8080';

export const MockUrlBar = () => {
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  console.log(mockRoute._id, { mockRoute });
  const patchMockRoute = useMockRoutePatcher();
  const formToMockBin = async ({ statusCode, headersArray, body }: { statusCode: number; headersArray: RequestHeader[]; body: string }): Promise<MockbinInput> => {
    const contentType = headersArray.find(h => h.name.toLowerCase() === 'content-type')?.value || CONTENT_TYPE_PLAINTEXT;
    return {
      'status': +statusCode,
      'statusText': RESPONSE_CODE_REASONS[+statusCode] || '',
      'httpVersion': 'HTTP/1.1',
      'headers': headersArray.filter(({ name }) => !!name),
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
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const createandSendRequest = ({ url, parentId, bin }: { url: string; parentId: string; bin?: Partial<MockbinInput> }) =>
    requestFetcher.submit(JSON.stringify({ url, parentId, bin }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });
  const test = async () => {
    console.log('test', mockRoute);
    const bin = await formToMockBin({
      statusCode: 200,
      headersArray: mockRoute.headers,
      body: mockRoute.body,
    });
    // compare bin to mockRoute bins to see if it already exists
    // if it does, use that id, heres a dumb way
    const alreadyCreatedBin = mockRoute.bins.find(b => {
      return b.content.text === bin.content.text
        && b.content.mimeType === bin.content.mimeType
        && b.status === bin.status
        && b.statusText === bin.statusText
        && b.headers.length === bin.headers.length
        && b.headers.every(h => bin.headers.some(h2 => h.name === h2.name && h.value === h2.value));
    });
    let id = alreadyCreatedBin?.binId;
    if (!alreadyCreatedBin) {
      id = await createBinOnRemoteFromResponse(bin);
    }
    const url = mockbinUrl + '/bin/' + id;
    invariant(id, 'mockbin failed to return an id, its possible it does not support something within the request body');
    console.log('test', url);
    patchMockRoute(mockRoute._id, { path: url, bins: [...mockRoute.bins, { binId: id, ...bin }] });
    createandSendRequest({
      url,
      parentId: mockRoute._id,
      bin,
    });
  };
  return (<div className='w-full flex justify-between urlbar'>
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
    <div className='flex p-1 truncate items-center opacity-50 cursor-not-allowed'>
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
        className="urlbar__send-btn rounded-sm"
        onPress={test}
      >
        Test
      </Button>
    </div>
  </div>);
};
