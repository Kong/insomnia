import { IconName } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { useState } from 'react';
import { Button, Collection, ComboBox, Dialog, DialogTrigger, Header, Input, Keyboard, Label, ListBox, ListBoxItem, Modal, ModalOverlay, Section, Text } from 'react-aria-components';
import { useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from '../../common/hotkeys';
import { fuzzyMatch } from '../../common/misc';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRequest } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { isWebSocketRequest } from '../../models/websocket-request';
import { Workspace } from '../../models/workspace';
import { scopeToActivity, WorkspaceScope } from '../../models/workspace';
import { ProjectLoaderData } from '../routes/project';
import { RootLoaderData } from '../routes/root';
import { Collection as WorkspaceCollection, WorkspaceLoaderData } from '../routes/workspace';
import { Icon } from './icon';
import { useDocBodyKeyboardShortcuts } from './keydown-binder';
import { getMethodShortHand } from './tags/method-tag';

export const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    organizationId,
    projectId,
    workspaceId,
    requestId,
  } = useParams();
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const projectData = useRouteLoaderData('/project/:projectId') as ProjectLoaderData | undefined;
  const { settings } = useRouteLoaderData('root') as RootLoaderData;
  let collection: WorkspaceCollection = [];
  let workspaces: Workspace[] = [];
  if (workspaceData) {
    collection = workspaceData.collection;
    workspaces = workspaceData.workspaces;
  } else if (projectData) {
    workspaces = projectData.workspaces.map(workspace => workspace.workspace);
  }

  const navigate = useNavigate();
  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
    },
  });

  const requestSwitchKeyCombination = getPlatformKeyCombinations(settings.hotKeyRegistry.request_quickSwitch)[0];
  const scopeToIconMap: Record<string, IconName> = {
    design: 'file',
    collection: 'bars',
    'mock-server': 'server',
  };

  return (
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button data-testid='quick-search' className="px-4 py-1 h-[30.5px] flex-shrink-0 flex items-center justify-center gap-2 bg-[--hl-xs] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] ring-inset ring-transparent ring-1 focus:ring-[--hl-md] transition-all text-sm">
        <Icon icon="search" />
        Search..
        {requestSwitchKeyCombination && <Keyboard className='space-x-0.5 items-center font-sans font-normal text-center text-sm shadow-sm bg-[--hl-xs] text-[--hl] rounded-md py-0.5 px-2 inline-block'>
          {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
        </Keyboard>}
      </Button>
      <ModalOverlay isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex pt-20 justify-center bg-black/30">
      <Modal className="max-w-2xl h-max w-full rounded-md flex flex-col overflow-hidden border border-solid border-[--hl-sm] max-h-[80vh] bg-[--color-bg] text-[--color-font]">
        <Dialog className="outline-none h-max overflow-hidden flex flex-col">
          {({ close }) => (
            <ComboBox
              aria-label='Quick switcher'
              className='flex flex-col divide-y divide-solid divide-[--hl-sm] overflow-hidden'
              autoFocus
              allowsCustomValue={false}
              menuTrigger='focus'
              shouldFocusWrap
              defaultFilter={(text, filter) => {
                return Boolean(fuzzyMatch(
                    filter,
                    text,
                    { splitSpace: false, loose: true }
                )?.indexes);
              }}
              onSelectionChange={itemId => {
                if (!itemId) {
                  return;
                }
                const isWorkspace = itemId.toString().startsWith('wrk_');
                if (isWorkspace) {
                  const [id, scope] = itemId.toString().split('|');
                  const activity = scopeToActivity(scope as WorkspaceScope);
                  navigate(`/organization/${organizationId}/project/${projectId}/workspace/${id}/${activity}`);
                } else {
                  navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${itemId}`);
                }
                close();
              }}
            >
              <Label
                aria-label="Filter"
                className="group relative flex items-center gap-2 p-2 flex-1"
              >
                <Icon icon="search" className="text-[--color-font] pl-2" />
                <Input
                  placeholder="Search and switch between requests, collections and documents"
                  className="py-1 w-full pl-2 pr-7 bg-[--color-bg] text-[--color-font]"
                />
              </Label>
              <ListBox
                className="flex-1 overflow-y-auto outline-none flex flex-col data-[empty]:hidden"
                items={[
                  {
                    id: 'requests',
                    name: 'Requests',
                    children: collection.map(item => item.doc).filter(item => !isRequestGroup(item)).map(item => ({
                      id: item._id,
                      icon: isRequest(item) ? (
                        <span
                          className={
                            `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                              'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                              'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                              'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                              'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                              'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                              'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                            }[item.method] || 'text-[--color-font] bg-[--hl-md]'}`
                          }
                        >
                          {getMethodShortHand(item)}
                        </span>
                      ) : isWebSocketRequest(item) ? (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
                          WS
                        </span>
                      ) : isGrpcRequest(item) && (
                        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
                          gRPC
                        </span>
                      ),
                      name: item.name,
                      description: !isRequestGroup(item) ? item.url : '',
                      textValue: !isRequestGroup(item) ? `${isRequest(item) ? item.method : isWebSocketRequest(item) ? 'WebSocket' : 'gRPC'} ${item.name} ${item.url}` : '',
                    })),
                  },
                  {
                    id: 'collections-and-documents',
                    name: 'Collections and documents',
                    children: workspaces.map(workspace => ({
                      id: workspace._id + '|' + workspace.scope,
                      icon: <Icon icon={scopeToIconMap[workspace.scope]} className="text-[--color-font] w-10 flex-shrink-0 flex items-center justify-center" />,
                      name: workspace.name,
                      description: '',
                      textValue: `${workspace.scope} ${workspace.name}`,
                    })),
                  },
                ]}
              >
                {section => (
                  <Section className='flex-1 flex flex-col'>
                    <Header className='p-2 text-xs uppercase text-[--hl] select-none'>{section.name}</Header>
                    <Collection items={section.children}>
                      {item => (
                        <ListBoxItem textValue={item.textValue} className="group outline-none select-none">
                          <div
                            className={`flex select-none outline-none ${item.id === workspaceId || item.id === requestId ? 'text-[--color-font] font-bold' : 'text-[--hl]'} group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-data-[focused]:bg-[--hl-sm] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden`}
                          >
                            {item.icon}
                            <Text className="flex-1 px-1 truncate" slot="label">{item.name}</Text>
                            <Text className="flex-1 px-1 truncate" slot="description">{item.description}</Text>
                          </div>
                        </ListBoxItem>
                      )}
                    </Collection>
                  </Section>
                )}
              </ListBox>
            </ComboBox>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
    </DialogTrigger>
  );
};
