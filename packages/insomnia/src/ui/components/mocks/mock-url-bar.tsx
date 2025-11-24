import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';
import { useMockRouteLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

import { getMockServiceBinURL } from '../../../common/constants';
import * as models from '../../../models';
import { useTimeoutWhen } from '../../hooks/use-timeout-when';
import { Dropdown, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Icon } from '../icon';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';
import { PromptModal } from '../modals/prompt-modal';

export const MockUrlBar = ({ onSend }: { onSend: (path: string) => void }) => {
  const { mockServer, mockRoute } = useMockRouteLoaderData()!;
  const { settings } = useRootLoaderData()!;
  const { hotKeyRegistry } = settings;
  const [pathInput, setPathInput] = useState<string>(mockRoute.name);
  const dropdownRef = useRef<DropdownHandle>(null);
  const [currentInterval, setCurrentInterval] = useState<number | null>(null);
  const [currentTimeout, setCurrentTimeout] = useState<number | undefined>(undefined);

  useEffect(() => {
    setPathInput(mockRoute.name);
  }, [mockRoute.name]);

  const send = () => {
    setCurrentTimeout(undefined);
    onSend(pathInput);
  };
  reactUse.useInterval(send, currentInterval ? currentInterval : null);
  useTimeoutWhen(send, currentTimeout, !!currentTimeout);
  useDocBodyKeyboardShortcuts({
    request_send: () => {
      if (mockRoute.name) {
        send();
      }
    },
    request_showOptions: () => {
      dropdownRef.current?.toggle(true);
    },
  });
  const isCancellable = currentInterval || currentTimeout;
  return (
    <div className="flex w-full items-center gap-2 self-stretch p-2">
      <div className="flex-shrink-0 rounded-sm bg-[--hl-xs] px-3 py-1">
        <span className={`http-method-${mockRoute.method} text-sm font-medium`}>{mockRoute.method}</span>
      </div>
      <div className="flex flex-1 items-center rounded-sm border border-[--hl-sm] bg-[--color-bg] px-3 py-1">
        <span className="flex-1 font-mono text-sm text-[--color-font]">{pathInput}</span>
      </div>

      <Button
        className="flex-shrink-0 rounded-sm bg-[--hl-sm] px-3 py-1 text-sm text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-xs]"
        onPress={() => {
          showModal(AlertModal, {
            title: 'Full URL',
            message: getMockServiceBinURL(mockServer, pathInput),
            onConfirm: () => window.clipboard.writeText(getMockServiceBinURL(mockServer, pathInput)),
            addCancel: true,
            okLabel: 'Copy',
          });
        }}
      >
        <Icon icon="eye" /> Show URL
      </Button>

      <Button
        className="flex-shrink-0 rounded-sm bg-[--hl-sm] px-3 py-1 text-sm text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-xs]"
        onPress={() => {
          window.clipboard.writeText(getMockServiceBinURL(mockServer, pathInput));
        }}
      >
        <Icon icon="copy" /> Copy
      </Button>

      <div className="flex flex-shrink-0">
        <Button
          className="ml-1 rounded-l-sm bg-[--color-surprise] px-5 text-[--color-font-surprise] hover:bg-opacity-90 focus:bg-opacity-90"
          onPress={() => {
            if (isCancellable) {
              setCurrentInterval(null);
              setCurrentTimeout(undefined);
              return;
            }
            onSend(pathInput);
          }}
        >
          {isCancellable ? 'Stop' : 'Test'}
        </Button>
        <Dropdown
          key="dropdown"
          className="flex"
          ref={dropdownRef}
          aria-label="Request Options"
          closeOnSelect={false}
          triggerButton={
            <Button
              className="rounded-r-sm bg-[--color-surprise] px-1 text-[--color-font-surprise]"
              style={{
                borderTopRightRadius: '0.125rem',
                borderBottomRightRadius: '0.125rem',
              }}
            >
              <i className="fa fa-caret-down" />
            </Button>
          }
        >
          <DropdownSection aria-label="Basic Section" title="Basic">
            <DropdownItem aria-label="send-now">
              <ItemContent
                icon="arrow-circle-o-right"
                label="Send Now"
                hint={hotKeyRegistry.request_send}
                onClick={send}
              />
            </DropdownItem>
            <DropdownItem aria-label="Generate Client Code">
              <ItemContent
                icon="code"
                label="Generate Client Code"
                onClick={async () => {
                  const request = await models.request.getByParentId(mockRoute._id);
                  request &&
                    showModal(GenerateCodeModal, {
                      request: { ...request, url: getMockServiceBinURL(mockServer, pathInput) },
                    });
                }}
              />
            </DropdownItem>
          </DropdownSection>
          <DropdownSection aria-label="Advanced Section" title="Advanced">
            <DropdownItem aria-label="Send After Delay">
              <ItemContent
                icon="clock-o"
                label="Send After Delay"
                onClick={() =>
                  showModal(PromptModal, {
                    inputType: 'decimal',
                    title: 'Send After Delay',
                    label: 'Delay in seconds',
                    defaultValue: '3',
                    onComplete: seconds => {
                      setCurrentTimeout(+seconds * 1000);
                    },
                  })
                }
              />
            </DropdownItem>
            <DropdownItem aria-label="Repeat on Interval">
              <ItemContent
                icon="repeat"
                label="Repeat on Interval"
                onClick={() =>
                  showModal(PromptModal, {
                    inputType: 'decimal',
                    title: 'Send on Interval',
                    label: 'Interval in seconds',
                    defaultValue: '3',
                    submitName: 'Start',
                    onComplete: seconds => {
                      setCurrentInterval(+seconds * 1000);
                    },
                  })
                }
              />
            </DropdownItem>
          </DropdownSection>
        </Dropdown>
      </div>
    </div>
  );
};
