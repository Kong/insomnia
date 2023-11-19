import React from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { MockbinInput } from '../../../models/mock-route';
import { RequestHeader } from '../../../models/request';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { useMockRoutePatcher } from '../editors/mock-response-headers-editor';
const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});
const StyledUrlBar = styled.div`
width: 100%;
height: 100%;
display: flex;
flex-direction: row;
justify-content: space-between;
align-items: stretch;
`;

const mockbinUrl = 'http://localhost:8080';

export const MockUrlBar = () => {
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  console.log(mockRoute._id, { mockRoute });
  const patchMockRoute = useMockRoutePatcher();
  const formToMockBin = async ({ statusCode, headersArray, body }: { statusCode: number; headersArray: RequestHeader[]; body: string }) => {
    // const headersArray = headers.split(/\r?\n|\r/g).map(l => l.split(/:\s(.+)/))
    //   .filter(([n]) => !!n)
    //   .map(([name, value = '']) => ({ name, value }));
    const contentType = headersArray.find(h => h.name.toLowerCase() === 'content-type')?.value || CONTENT_TYPE_PLAINTEXT;
    // console.log({ headersArray });
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

  const test = async () => {
    console.log('test', mockRoute);
    const bin = await formToMockBin({
      statusCode: 200,
      headersArray: mockRoute.headers,
      body: mockRoute.body,
    });
    const id = await createBinOnRemoteFromResponse(bin);
    const url = mockbinUrl + '/bin/' + id;
    console.log('test', url);
    patchMockRoute(mockRoute._id, { path: url, bins: [...mockRoute.bins, { binId: id, ...bin }] });
    // send to bin
    const response = await window.main.axiosRequest({
      url: mockbinUrl + '/bin/' + id,
      method: 'get',
    });
    console.log({ response });
  };
  return (<>
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
        onPress={test}
      >Test</Button>
    </div>
  </>);
};
