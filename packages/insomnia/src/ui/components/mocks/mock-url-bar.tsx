import React from 'react';
import { Button } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { getResponseCookiesFromHeaders, HarResponse } from '../../../common/har';
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
  const patchMockRoute = useMockRoutePatcher();
  const formToHar = async ({ statusCode, headersArray, body }: { statusCode: number; headersArray: RequestHeader[]; body: string }): Promise<HarResponse> => {
    const contentType = headersArray.find(h => h.name.toLowerCase() === 'content-type')?.value || CONTENT_TYPE_PLAINTEXT;
    const validHeaders = headersArray.filter(({ name }) => !!name);
    return {
      status: +statusCode,
      statusText: RESPONSE_CODE_REASONS[+statusCode] || '',
      httpVersion: 'HTTP/1.1',
      headers: validHeaders,
      cookies: getResponseCookiesFromHeaders(validHeaders),
      content: {
        size: Buffer.byteLength(body),
        mimeType: contentType,
        text: body,
        compression: 0,
      },
      headersSize: -1,
      bodySize: -1,
      redirectURL: '',
    };
  };
  const upsertBinOnRemoteFromResponse = async (binResponse: HarResponse, binId: string | null): Promise<string> => {
    try {
      if (binId) {
        const bin = await window.main.axiosRequest({
          url: mockbinUrl + `/bin/${binId}`,
          method: 'put',
          data: binResponse,
        });
        if (bin?.data) {
          return bin.data;
        }
      }
      const bin = await window.main.axiosRequest({
        url: mockbinUrl + '/bin/create',
        method: 'post',
        data: binResponse,
      });
      if (bin?.data) {
        return bin.data;
      }
    } catch (e) {
      // todo: handle error better
      console.log(e);
    }
    console.log('Error: creating bin on remote');
    return '';

  };
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const createandSendRequest = ({ url, parentId, binResponse }: { url: string; parentId: string; binResponse?: Partial<HarResponse> }) =>
    requestFetcher.submit(JSON.stringify({ url, parentId, binResponse }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });

  const upsertMockbinHarAndTestIt = async () => {
    const binResponse = await formToHar({
      statusCode: mockRoute.statusCode,
      headersArray: mockRoute.headers,
      body: mockRoute.body,
    });
    const id = await upsertBinOnRemoteFromResponse(binResponse, mockRoute?.binId);
    const url = mockbinUrl + '/bin/' + id;
    invariant(id, 'mockbin failed to return an id, its possible it does not support something within the request body');
    patchMockRoute(mockRoute._id, { path: url, binId: id, binResponse });
    createandSendRequest({
      url,
      parentId: mockRoute._id,
      binResponse,
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
        onPress={upsertMockbinHarAndTestIt}
      >
        Test
      </Button>
    </div>
  </div>);
};
