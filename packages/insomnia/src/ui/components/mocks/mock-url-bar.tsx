import React, { useState } from 'react';
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
import { Icon } from '../icon';
import { showAlert, showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
const StyledDropdownButton = styled(DropdownButton)({
  '&&': {
    paddingLeft: 'var(--padding-sm)',
  },
});

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
        url: mockbinUrl + `/bin/${compoundId}`,
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

  const createandSendRequest = ({ url, parentId, binResponse }: { url: string; parentId: string; binResponse?: Partial<HarResponse> }) =>
    requestFetcher.submit(JSON.stringify({ url, parentId, binResponse }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-mock-send`,
        method: 'post',
      });

  const upsertMockbinHar = async () => {
    const compoundId = mockRoute._id + pathInput;
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
      url: mockbinUrl + '/bin/' + mockRoute._id,
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
  return (<div className='w-full flex justify-between urlbar'>
    {/* <Dropdown
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
    </Dropdown> */}
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 mr-1 rounded-sm"
        onPress={() => window.clipboard.writeText(mockRoute.url)}
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

    <div className='flex p-1 items-center'>
      <div className="opacity-50 cursor-pointer">
        <span onClick={showFullURL}>[mock resource url]</span>
      </div>
      <div>
        <input
          value={pathInput}
          onChange={e => setPathInput(e.currentTarget.value)}
        />
      </div>
    </div>
    <span className='flex-1' />
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={upsertMockbinHar}
      >
        <Icon icon="save" />
      </Button>
      <Button
        className="urlbar__send-btn rounded-sm"
        onPress={() => {
          upsertMockbinHar();
          const compoundId = mockRoute._id + pathInput;
          createandSendRequest({
            url: mockbinUrl + '/bin/' + compoundId,
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
