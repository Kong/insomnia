import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { getMockServiceURL, HTTP_METHODS } from '../../../common/constants';
import { MockRouteLoaderData, useMockRoutePatcher } from '../../routes/mock-route';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';

export const MockUrlBar = ({ onPathUpdate, onSend }: { onPathUpdate: (path: string) => void; onSend: (path: string) => void }) => {
  const { mockServer, mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const [pathInput, setPathInput] = useState<string>(mockRoute.name);
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
        onPress={() => {
          const compoundId = mockRoute.parentId + pathInput;
          showModal(AlertModal, {
          title: 'Full URL',
            message: mockbinUrl + '/bin/' + compoundId,
          });
        }}
      >
        <Icon icon="eye" /> Show URL
      </Button>
    </div>

    <div className='flex flex-1 p-1 items-center'>
      <input className='flex-1' onBlur={() => onPathUpdate(pathInput)} value={pathInput} onChange={e => setPathInput(e.currentTarget.value)} />
    </div>
    <div className='flex p-1'>
      <Button
        className="bg-[--hl-sm] px-3 rounded-sm aria-pressed:bg-[--hl-xs] data-[pressed]:bg-[--hl-xs]"
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
