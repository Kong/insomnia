import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { CONTENT_TYPE_PLAINTEXT, getMockServiceURL, HTTP_METHODS, RESPONSE_CODE_REASONS } from '../../../common/constants';
import { getResponseCookiesFromHeaders, HarResponse } from '../../../common/har';
import { RequestHeader } from '../../../models/request';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { useMockRoutePatcher } from '../editors/mock-response-headers-editor';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

export const formToHar = ({ statusCode, statusText, headersArray, body }: { statusCode: number; statusText: string; headersArray: RequestHeader[]; body: string }): HarResponse => {
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
export const MockUrlBar = ({ onPathUpdate, onSend }: { onPathUpdate: (path: string) => void; onSend: (path: string) => void }) => {
  const { mockServer, mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const [pathInput, setPathInput] = useState<string>(mockRoute.path);
  const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;
  return (<div className='w-full flex justify-between urlbar'>
    <Dropdown
      className="method-dropdown"
      triggerButton={
        <DropdownButton className="pad-right pad-left vertically-center hover:bg-[--color-surprise] focus:bg-[--color-surprise]">
          <span className={`http-method-${mockRoute.method}`}>{mockRoute.method}</span>{' '}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
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
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={() => showModal(AlertModal, {
          title: 'Full URL',
          message: mockRoute.url,
        })}
      >
        <Icon icon="eye" /> Show URL
      </Button>
    </div>

    <div className='flex flex-1 p-1 items-center'>
      <input className='flex-1' onBlur={() => pathInput !== mockRoute.path && onPathUpdate(pathInput)} value={pathInput} onChange={e => setPathInput(e.currentTarget.value)} />
    </div>
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm"
        onPress={() => {
          const compoundId = mockRoute.parentId + pathInput;
          window.clipboard.writeText(mockbinUrl + '/bin/' + compoundId);
        }}
      >
        <Icon icon="copy" />
      </Button>
      <Button
        className="px-5 ml-1 text-[--color-font-surprise] bg-[--color-surprise] hover:bg-opacity-90 rounded-sm"
        onPress={() => onSend(pathInput)}
      >
        Test
      </Button>
    </div>
  </div>);
};
