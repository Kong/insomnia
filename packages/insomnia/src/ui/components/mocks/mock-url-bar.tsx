import React from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { RENDER_PURPOSE_SEND } from '../../../common/render';
import * as models from '../../../models';
import { MockbinInput } from '../../../models/mock-route';
import { RequestHeader } from '../../../models/request';
import { fetchRequestData, responseTransform, sendCurlAndWriteTimeline, tryToInterpolateRequest, tryToTransformRequestWithPlugins } from '../../../network/network';
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
    console.log('test', url);
    patchMockRoute(mockRoute._id, { path: url, bins: [...mockRoute.bins, { binId: id, ...bin }] });
    // send to bin
    // create private request

    const req = await models.request.create({
      url,
      headers: bin.headers,
      body: {
        mimeType: bin.content.mimeType,
        text: bin.content.text,
      },
      isPrivate: true,
      parentId: mockRoute._id,
    });
    const { request,
      environment,
      settings,
      clientCertificates,
      caCert,
      activeEnvironmentId } = await fetchRequestData(req._id);

    const renderResult = await tryToInterpolateRequest(request, environment._id, RENDER_PURPOSE_SEND);
    const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);
    const res = await sendCurlAndWriteTimeline(
      renderedRequest,
      clientCertificates,
      caCert,
      settings,
    );
    const response = await responseTransform(res, activeEnvironmentId, renderedRequest, renderResult.context);
    await models.response.create(response);
    // needs to be moved to action in order to trigger loader
    // const response = await window.main.axiosRequest({
    //   url: mockbinUrl + '/bin/' + id,
    //   method: 'get',
    // });
    console.log({ response });

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
