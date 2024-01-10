import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { CONTENT_TYPE_PLAINTEXT, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { getResponseCookiesFromHeaders, HarResponse } from '../../../common/har';
import { RequestHeader } from '../../../models/request';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { useMockRoutePatcher } from '../editors/mock-response-headers-editor';
import { Icon } from '../icon';
import { showAlert, showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

const mockbinUrl = 'http://localhost:8080';

export const MockUrlBar = () => {
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const [pathInput, setPathInput] = useState<string>(mockRoute.path);

  const formToHar = ({ statusCode, statusText, headersArray, body }: { statusCode: number; statusText: string; headersArray: RequestHeader[]; body: string }): HarResponse => {
    const contentType = headersArray.find(h => h.name.toLowerCase() === 'content-type')?.value || CONTENT_TYPE_PLAINTEXT;
    const validHeaders = headersArray.filter(({ name }) => !!name);
    return {
      status: +statusCode,
      statusText: statusText || RESPONSE_CODE_REASONS[+statusCode] || '',
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
  const upsertBinOnRemoteFromResponse = async (compoundId: string | null): Promise<string> => {
    try {
      const bin = await window.main.axiosRequest({
        url: mockbinUrl + `/bin/upsert/${compoundId}`,
        method: 'put',
        data: formToHar({
          statusCode: mockRoute.statusCode,
          statusText: mockRoute.statusText,
          headersArray: mockRoute.headers,
          body: mockRoute.body,
        }),
      });
      if (bin?.data?.errors) {
        console.error('error response', bin?.data?.errors);
        showAlert({
          title: 'Unexpected Request Failure',
          message: (
            <div>
              <p>The request failed due to an unhandled error:</p>
              <code className="wide selectable">
                <pre>{bin?.data?.errors}</pre>
              </code>
            </div>
          ),
        });
      }
      if (bin?.data?.length) {
        console.log('RES', bin.data);
        return bin.data;
      }

    } catch (e) {
      console.log(e);
      showAlert({
        title: 'Network error',
        message: (
          <div>
            <p>The request failed due to a network error:</p>
            <code className="wide selectable">
              <pre>{e.message}</pre>
            </code>
          </div>
        ),
      });
    }
    console.log('Error: creating bin on remote');
    return '';

  };
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const createandSendRequest = ({ url, method, parentId, binResponse }: { url: string; method: string; parentId: string; binResponse?: Partial<HarResponse> }) =>
    requestFetcher.submit(JSON.stringify({ url, method, parentId, binResponse }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });

  const upsertMockbinHar = async () => {
    const compoundId = mockRoute.parentId + pathInput;
    const id = await upsertBinOnRemoteFromResponse(compoundId);
    if (!id) {
      showAlert({
        title: 'Unexpected Mock Failure',
        message: (
          <div>
            <p>The request failed due to a error from mockbin</p>
          </div>
        ),
      });
      return;
    }
    patchMockRoute(mockRoute._id, {
      url: mockbinUrl + '/bin/' + mockRoute.parentId,
      path: pathInput,
      binResponse: formToHar({
        statusCode: mockRoute.statusCode,
        statusText: mockRoute.statusText,
        headersArray: mockRoute.headers,
        body: mockRoute.body,
      }),
    });

  };

  const showFullURL = () => {
    showModal(AlertModal, {
      title: 'Full URL',
      message: mockRoute.url,
    });
  };

  const StyledDropdownButton = styled(DropdownButton)({
    '&:hover:not(:disabled)': {
      backgroundColor: 'var(--color-surprise)',
    },

    '&:focus:not(:disabled)': {
      backgroundColor: 'var(--color-surprise)',
    },
  });

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
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 mr-1 rounded-sm"
        onPress={() => {
          const compoundId = mockRoute.parentId + pathInput;
          window.clipboard.writeText(mockbinUrl + '/bin/' + compoundId);
        }}
      >
        <Icon icon="copy" />
      </Button>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={showFullURL}
      >
        <Icon icon="eye" />
      </Button>
    </div>

    <div className='flex flex-1 p-1 items-center'>
      <div className="flex-shrink-0 opacity-50 cursor-pointer">
        <span onClick={showFullURL}>[mock resource url]</span>
      </div>
      <input className='flex-1' onBlur={upsertMockbinHar} value={pathInput} onChange={e => setPathInput(e.currentTarget.value)} />
    </div>
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={upsertMockbinHar}
      >
        <Icon icon="save" />
      </Button>
      <Button
        className="px-5 ml-1 text-[--color-font-surprise] bg-[--color-surprise] hover:bg-opacity-90 rounded-sm"
        onPress={() => {
          upsertMockbinHar();
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
        }}
      >
        Test
      </Button>
    </div>
  </div>);
};
