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
import { scopeToActivity } from '../../models/workspace';
import { useInsomniaEventStreamContext } from '../context/app/insomnia-event-stream-context';
import { LoaderResult } from '../routes/commands';
import { ProjectLoaderData, scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../routes/project';
import { RootLoaderData } from '../routes/root';
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

  const projectRouteData = useRouteLoaderData('/project/:projectId') as ProjectLoaderData | undefined;
  const { settings } = useRouteLoaderData('root') as RootLoaderData;
  const { presence } = useInsomniaEventStreamContext();
  const pullFileFetcher = useFetcher();
  const setActiveEnvironmentFetcher = useFetcher();
  const navigate = useNavigate();

  const projectDataLoader = useFetcher<ProjectLoaderData>();
  const accountId = getAccountId();

  useEffect(() => {
    if (!projectRouteData && !projectDataLoader.data && projectDataLoader.state === 'idle' && !isScratchpadOrganizationId(organizationId)) {
      projectDataLoader.load(`/organization/${organizationId}/project/${projectId}`);
    }
  }, [organizationId, projectRouteData, projectDataLoader, projectId]);

  const commandsLoader = useFetcher<LoaderResult>();

  const projectData = projectRouteData || projectDataLoader.data;

  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
      const searchParams = new URLSearchParams();

      searchParams.set('organizationId', organizationId);
      searchParams.set('workspaceId', workspaceId);
      searchParams.set('projectId', projectId);

      commandsLoader.load(`/commands?${searchParams.toString()}`);
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
      description: React.ReactNode;
      textValue: string;
    }[];
  }[] = [];

  const currentRequests = commandsLoader.data?.current.requests.map(request => ({
    ...request,
    action: () => {
      navigate(request.url);
    },
  })) || [];

  const currentFiles = projectData?.files.map(file => ({
    ...file,
    action: () => {
      if (file.scope === 'unsynced') {
        if (!projectData || !file.remoteId) {
          return null;
        }
        pullFileFetcher.submit({ backendProjectId: file.remoteId, remoteId: projectData?.activeProject.remoteId }, {
          method: 'POST',
          action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
        });

        return true;
      } else {
        navigate(`/organization/${organizationId}/project/${projectId}/workspace/${file.id}/${scopeToActivity(file.scope)}`);
        return null;
      }
    },
  })) || [];

  const currentEnvironments = commandsLoader.data?.current.environments.map(environment => ({
    ...environment,
    id: environment._id,
    action: () => {
      setActiveEnvironmentFetcher.submit(
        {
          environmentId: environment._id,
        },
        {
          method: 'POST',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
        }
      );
    },
  })) || [];

  const otherRequests = commandsLoader.data?.other.requests.map(request => ({
    ...request,
    action: () => {
      navigate(request.url);
    },
  })) || [];

  const otherFiles = commandsLoader.data?.other.files.map(file => ({
    ...file,
    action: () => {
      navigate(file.url);
    },
  })) || [];

  currentRequests.length > 0 && comboboxSections.push({
    id: 'current-requests',
    name: 'Requests',
    children: currentRequests.map(request => ({
      id: request.item._id,
      icon: isRequest(request.item) ? (
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
            }[request.item.method] || 'text-[--color-font] bg-[--hl-md]'}`
          }
        >
          {getMethodShortHand(request.item)}
        </span>
      ) : isWebSocketRequest(request.item) ? (
        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
          WS
        </span>
        ) : isGrpcRequest(request.item) && (
        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
          gRPC
        </span>
      ),
      name: request.name,
      presence: [],
      description: request.item.url,
      textValue: `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name} ${request.url}`,
    })),
  });

  currentFiles.length > 0 && comboboxSections.push({
    id: 'collections-and-documents',
    name: 'Collections and documents',
    children: currentFiles.map(file => ({
      id: file.id,
      icon: <span className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} rounded aspect-square h-6 flex items-center justify-center`}><Icon icon={scopeToIconMap[file.scope]} className="w-4" /></span>,
      name: file.name,
      description: <span className='flex items-center gap-1'><span className='px-2 text-[--hl]'>{scopeToLabelMap[file.scope]}</span></span>,
      textValue: file.name + ' ' + scopeToLabelMap[file.scope],
      loading: Boolean(pullFileFetcher.formData?.get('backendProjectId') && pullFileFetcher.formData?.get('backendProjectId') === file.remoteId),
      presence: presence
        .filter(p => p.project === projectData?.activeProject.remoteId && p.file === file.id)
        .filter(p => p.acct !== accountId)
        .map(user => {
          return {
            key: user.acct,
            alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
            src: user.avatar,
          };
        }),
    })),
  });

  currentEnvironments.length > 0 && comboboxSections.push({
    id: 'environments',
    name: 'Environments',
    children: currentEnvironments.map(environment => ({
      id: environment._id,
      icon: <span className='w-10 py-1 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font] bg-[--hl-md]'>
        <Icon
          icon={environment.isPrivate ? 'laptop-code' : 'globe-americas'}
          className='text-xs w-5'
          style={{
            color: environment.color ?? 'var(--color-font)',
          }}
        />
      </span>,
      name: environment.name,
      presence: [],
      description: `${environment.isPrivate ? 'Private' : 'Shared'} environment`,
      textValue: environment.name,
    })),
  });

  otherRequests.length > 0 && comboboxSections.push({
    id: 'other-requests',
    name: 'Other Requests',
    children: otherRequests.map(request => ({
      id: request.item._id,
      icon: isRequest(request.item) ? (
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
            }[request.item.method] || 'text-[--color-font] bg-[--hl-md]'}`
          }
        >
          {getMethodShortHand(request.item)}
        </span>
      ) : isWebSocketRequest(request.item) ? (
        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]">
          WS
        </span>
      ) : isGrpcRequest(request.item) && (
        <span className="w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]">
          gRPC
        </span>
      ),
      name: request.name,
      presence: [],
      description: <span className='flex items-center gap-1'>{request.organizationName}<span>/</span>{request.projectName}<span>/</span>{request.workspaceName}</span>,
      textValue: !isRequestGroup(request.item) ? `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name} ${request.url}` : '',
    })),
  });

  otherFiles.length > 0 && comboboxSections.push({
    id: 'other-collections-and-documents',
    name: 'Other collections and documents',
    children: otherFiles.map(file => ({
      id: file.item._id,
      icon: <span className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} rounded aspect-square h-6 flex items-center justify-center`}><Icon icon={scopeToIconMap[file.item.scope]} className="w-4" /></span>,
      name: file.name,
      description: <span className='flex items-center gap-1'><span className='px-2 text-[--hl]'>{scopeToLabelMap[file.item.scope]}</span>{file.organizationName}<span>/</span>{file.projectName}</span>,
      textValue: file.name + ' ' + scopeToLabelMap[file.item.scope],
      presence: presence
        .filter(p => p.project === projectData?.activeProject.remoteId && p.file === file.id)
        .filter(p => p.acct !== accountId)
        .map(user => {
          return {
            key: user.acct,
            alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
            src: user.avatar,
          };
        }),
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
    <DialogTrigger
      onOpenChange={isOpen => {
        setIsOpen(isOpen);
        if (isOpen) {
          const searchParams = new URLSearchParams();

          searchParams.set('workspaceId', workspaceId);
          searchParams.set('projectId', projectId);

          commandsLoader.load(`/commands?${searchParams.toString()}`);
        }
      }}
      isOpen={isOpen}
    >
      <Button data-testid='quick-search' className="px-4 py-1 h-[30.5px] flex-shrink-0 flex items-center justify-center gap-2 bg-[--hl-xs] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] ring-inset ring-transparent ring-1 focus:ring-[--hl-md] transition-all text-sm">
        <Icon icon="search" />
        Search..
        {requestSwitchKeyCombination && <Keyboard className='space-x-0.5 items-center font-sans font-normal text-center text-sm shadow-sm bg-[--hl-xs] text-[--hl] rounded-md py-0.5 px-2 inline-block'>
          {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
        </Keyboard>}
      </Button>
      <ModalOverlay isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex pt-20 justify-center bg-black/30">
        <Modal className="max-w-3xl h-max w-full rounded-md flex flex-col overflow-hidden border border-solid border-[--hl-sm] max-h-[80vh] bg-[--color-bg] text-[--color-font]">
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
              onInputChange={filter => {
                const searchParams = new URLSearchParams();

                searchParams.set('organizationId', organizationId);
                searchParams.set('projectId', projectId);
                searchParams.set('workspaceId', workspaceId);
                searchParams.set('filter', filter);

                commandsLoader.load(`/commands?${searchParams.toString()}`);
              }}
              defaultFilter={(textValue, filter) => {
                return Boolean(fuzzyMatch(
                  filter,
                  textValue,
                  { splitSpace: false, loose: true }
                )?.indexes);
              }}
              onSelectionChange={itemId => {
                if (!itemId) {
                  return;
                }

                const item = [
                  ...currentRequests,
                  ...currentFiles,
                  ...currentEnvironments,
                  ...otherRequests,
                  ...otherFiles,
                ].find(item => item.id === itemId);

                const result = item?.action();

                if (!result) {
                  close();
                }
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
                    className="outline-none relative overflow-y-auto flex-1"
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
                                <Text className="flex-shrink-0 px-1 truncate" slot="label">{item.name}</Text>
                                {item.presence.length > 0 && (
                                  <span className='w-[70px]'>
                                    <AvatarGroup
                                      size="small"
                                      maxAvatars={3}
                                      items={item.presence}
                                    />
                                  </span>
                                )}
                                <Text className="flex-1 px-1 truncate text-sm text-[--hl-md]" slot="description">{item.description}</Text>
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
