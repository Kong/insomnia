import React, { useEffect, useRef } from 'react';
import { useState } from 'react';
import { Button, Collection, ComboBox, Dialog, DialogTrigger, Header, Input, Keyboard, Label, ListBox, ListBoxItem, Modal, ModalOverlay, Section, Text } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { getAccountId } from '../../account/session';
import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from '../../common/hotkeys';
import { fuzzyMatch } from '../../common/misc';
import { isGrpcRequest } from '../../models/grpc-request';
import { isScratchpadOrganizationId } from '../../models/organization';
import { isRequest } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { isWebSocketRequest } from '../../models/websocket-request';
import { scopeToActivity, WorkspaceScope } from '../../models/workspace';
import { useInsomniaEventStreamContext } from '../context/app/insomnia-event-stream-context';
import { InsomniaFile, ProjectLoaderData, scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../routes/project';
import { RootLoaderData } from '../routes/root';
import { Collection as WorkspaceCollection, WorkspaceLoaderData } from '../routes/workspace';
import { AvatarGroup } from './avatar';
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
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const projectData = useRouteLoaderData('/project/:projectId') as ProjectLoaderData | undefined;
  const { settings } = useRouteLoaderData('root') as RootLoaderData;
  const { presence } = useInsomniaEventStreamContext();
  const pullFileFetcher = useFetcher();
  const navigate = useNavigate();

  const projectDataLoader = useFetcher<ProjectLoaderData>();

  useEffect(() => {
    if (!projectData && !projectDataLoader.data && projectDataLoader.state === 'idle' && !isScratchpadOrganizationId(organizationId)) {
      projectDataLoader.load(`/organization/${organizationId}/project/${projectId}`);
    }
  }, [organizationId, projectData, projectDataLoader, projectId]);

  let collection: WorkspaceCollection = [];
  let files: (InsomniaFile & {
    loading: boolean; presence: {
      key: string;
      alt: string;
      src: string;
    }[];
  })[] = [];

  if (workspaceData) {
    collection = workspaceData.collection;
  }

  const data = projectData || projectDataLoader.data;
  if (data) {
    const accountId = getAccountId();
    files = data?.files.map(file => {
      const workspacePresence = presence
        .filter(p => p.project === data.activeProject.remoteId && p.file === file.id)
        .filter(p => p.acct !== accountId)
        .map(user => {
          return {
            key: user.acct,
            alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
            src: user.avatar,
          };
        });
      return {
        ...file,
        loading: Boolean(pullFileFetcher.formData?.get('backendProjectId') && pullFileFetcher.formData?.get('backendProjectId') === file.remoteId),
        presence: workspacePresence,
      };
    });
  }

  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
    },
  });

  const requestSwitchKeyCombination = getPlatformKeyCombinations(settings.hotKeyRegistry.request_quickSwitch)[0];

  const comboboxSections: {
    id: string;
    name: string;
    children: {
      id: string;
      icon: React.ReactNode;
      name: string;
      presence: {
        key: string;
        alt: string;
        src: string;
      }[];
      description: string;
      textValue: string;
    }[];
  }[] = [];

  collection.length > 0 && comboboxSections.push({
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
      presence: [],
      description: !isRequestGroup(item) ? item.url : '',
      textValue: !isRequestGroup(item) ? `${isRequest(item) ? item.method : isWebSocketRequest(item) ? 'WebSocket' : 'gRPC'} ${item.name} ${item.url}` : '',
    })),
  });

  files.length > 0 && comboboxSections.push({
    id: 'collections-and-documents',
    name: 'Collections and documents',
    children: files.map(file => ({
      id: file.id,
      icon: <span className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} rounded aspect-square h-6 flex items-center justify-center`}><Icon icon={file.loading ? 'spinner' : scopeToIconMap[file.scope]} className={`w-4 ${file.loading ? 'animate-spin' : ''}`} /></span>,
      name: file.name,
      description: scopeToLabelMap[file.scope],
      textValue: file.name + ' ' + scopeToLabelMap[file.scope],
      presence: file.presence,
    })),
  });

  const prevPullFetcherState = useRef(pullFileFetcher.state);
  useEffect(() => {
    if (pullFileFetcher.state === 'idle' && prevPullFetcherState.current !== 'idle') {
      setIsOpen(false);
    }

    prevPullFetcherState.current = pullFileFetcher.state;
  }, [pullFileFetcher.state]);

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
              isDisabled={pullFileFetcher.state !== 'idle'}
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

                const file = files.find(file => file.id === itemId);

                if (file) {
                  if (file.scope === 'unsynced') {
                    if (data?.activeProject.remoteId && file.remoteId) {
                      return pullFileFetcher.submit({ backendProjectId: file.remoteId, remoteId: data?.activeProject.remoteId }, {
                        method: 'POST',
                        action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
                      });
                    }
                  } else {
                    const activity = scopeToActivity(file.scope as WorkspaceScope);
                    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${file.id}/${activity}`);
                  }
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
                {pullFileFetcher.state === 'idle' && (
                  <ListBox
                    className="flex-1 overflow-y-auto outline-none flex flex-col data-[empty]:hidden"
                    items={comboboxSections}
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
                                <span className='w-[70px]'>
                                  {item.presence.length > 0 && (
                                    <AvatarGroup
                                      size="small"
                                      maxAvatars={3}
                                      items={item.presence}
                                    />
                                  )}
                                </span>
                              </div>
                            </ListBoxItem>
                          )}
                        </Collection>
                      </Section>
                    )}
                  </ListBox>
                )}
                {pullFileFetcher.state !== 'idle' && (
                  <div
                    className="flex-1 overflow-y-auto outline-none flex flex-col data-[empty]:hidden"
                  >
                    {comboboxSections.map(section => (
                      <div className='flex-1 flex flex-col' key={section.id}>
                        <Header className='p-2 text-xs uppercase text-[--hl] select-none'>{section.name}</Header>
                        <div>
                          {section.children.map(item => (
                            <div key={item.id} className="group cursor-not-allowed outline-none select-none">
                              <div
                                className={`flex select-none outline-none ${item.id === workspaceId || item.id === requestId ? 'text-[--color-font] font-bold' : 'text-[--hl]'} group-aria-selected:text-[--color-font] relative transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden`}
                              >
                                {item.icon}
                                <span className="flex-1 px-1 truncate">{item.name}</span>
                                <span className="flex-1 px-1 truncate">{item.description}</span>
                                <span className='w-[70px]'>
                                  {item.presence.length > 0 && (
                                    <AvatarGroup
                                      size="small"
                                      maxAvatars={3}
                                      items={item.presence}
                                    />
                                  )}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </ComboBox>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
    </DialogTrigger>
  );
};
