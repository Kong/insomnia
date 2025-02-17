import React, { memo, useEffect, useRef } from 'react';
import { useState } from 'react';
import { Button, Collection, ComboBox, Dialog, DialogTrigger, Header, Input, Keyboard, Label, ListBox, ListBoxItem, Modal, ModalOverlay, Popover, Section, Text } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from '../../common/hotkeys';
import { fuzzyMatch } from '../../common/misc';
import { isGrpcRequest } from '../../models/grpc-request';
import { isRequest } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { isWebSocketRequest } from '../../models/websocket-request';
import { useInsomniaEventStreamContext } from '../context/app/insomnia-event-stream-context';
import type { LoaderResult, RemoteFilesLoaderResult } from '../routes/commands';
import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../routes/project';
import type { RootLoaderData } from '../routes/root';
import { AvatarGroup } from './avatar';
import { Icon } from './icon';
import { useDocBodyKeyboardShortcuts } from './keydown-binder';
import { showAlert } from './modals';
import { getMethodShortHand } from './tags/method-tag';

export const CommandPalette = memo(function CommandPalette({ style = {} }: { style?: React.CSSProperties }) {
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useRouteLoaderData('root') as RootLoaderData;

  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
    },
  });

  const requestSwitchKeyCombination = getPlatformKeyCombinations(settings.hotKeyRegistry.request_quickSwitch)[0];

  return (
    <DialogTrigger
      onOpenChange={setIsOpen}
      isOpen={isOpen}
    >
      <Button style={{ ...style }} data-testid='quick-search' className="px-4 py-1 h-[30.5px] flex-shrink-0 flex items-center justify-between gap-2 bg-[--hl-xs] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-md text-[--color-font] hover:bg-[--hl-xs] ring-inset ring-transparent ring-1 focus:ring-[--hl-md] transition-all text-sm">
        <div>
          <Icon icon="search" className='mr-2' />
          Search..
        </div>
        {requestSwitchKeyCombination && <Keyboard className='space-x-0.5 items-center font-sans font-normal text-center text-sm shadow-sm bg-[--hl-xs] text-[--hl] rounded-md py-0.5 px-2 inline-block'>
          {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
        </Keyboard>}
      </Button>
      <ModalOverlay isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex pt-20 justify-center bg-black/30">
        <Modal className="max-w-3xl w-full">
          <Dialog aria-label='Command palette dialog' className="outline-none">
            {({ close }) => (
              <CommandPaletteCombobox close={close} />
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
});

const CommandPaletteCombobox = ({ close }: { close: () => void }) => {
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

  const { userSession } = useRouteLoaderData('root') as RootLoaderData;
  const { presence } = useInsomniaEventStreamContext();
  const pullFileFetcher = useFetcher();
  const setActiveEnvironmentFetcher = useFetcher();
  const navigate = useNavigate();

  const accountId = userSession.accountId;

  const commandsLoader = useFetcher<LoaderResult>();

  const remoteFilesLoader = useFetcher<RemoteFilesLoaderResult>();

  useEffect(() => {
    if (!commandsLoader.data && commandsLoader.state === 'idle') {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', organizationId);
      searchParams.set('workspaceId', workspaceId);
      searchParams.set('projectId', projectId);

      commandsLoader.load(`/commands?${searchParams.toString()}`);
    }
  }, [commandsLoader, organizationId, projectId, workspaceId]);

  useEffect(() => {
    if (!remoteFilesLoader.data && remoteFilesLoader.state === 'idle') {
      remoteFilesLoader.load('/remote-files');
    }
  }, [remoteFilesLoader]);

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

  const remoteFiles = remoteFilesLoader.data?.files || [];

  const currentFilesData = commandsLoader.data?.current.files || [];
  const currentRemoteFilesData = remoteFiles.filter(file => file.item.teamProjectLocalId === projectId).filter(file => !currentFilesData.some(f => f.id === file.item.id));

  const currentFiles = [...currentFilesData, ...currentRemoteFilesData]?.map(file => ({
    ...file,
    action: () => {
      if ('pullUrl' in file && file.pullUrl) {
        pullFileFetcher.submit({ backendProjectId: file.item.projectId, remoteId: file.item.teamProjectId }, {
          method: 'POST',
          action: file.pullUrl,
        });

        return true;
      } else {
        navigate(file.url);
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

      return true;
    },
  })) || [];

  const otherRequests = commandsLoader.data?.other.requests.map(request => ({
    ...request,
    action: () => {
      navigate(request.url);
    },
  })) || [];

  const otherFilesData = commandsLoader.data?.other.files || [];
  const otherRemoteFilesData = remoteFiles.filter(file => file.item.teamProjectLocalId !== projectId).filter(file => !otherFilesData.some(f => f.id === file.item.id));

  const otherFiles = [...otherFilesData, ...otherRemoteFilesData].map(file => ({
    ...file,
    action: () => {
      if ('pullUrl' in file && file.pullUrl) {
        pullFileFetcher.submit({ backendProjectId: file.item.projectId, remoteId: file.item.teamProjectId }, {
          method: 'POST',
          action: file.pullUrl,
        });

        return true;
      } else {
        navigate(file.url);
        return null;
      }
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
      icon: <span className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} rounded aspect-square h-6 flex items-center justify-center`}><Icon icon={scopeToIconMap[file.item.scope]} className="w-4" /></span>,
      name: file.name,
      description: <span className='flex items-center gap-1'><span className='px-2 text-[--hl]'>{scopeToLabelMap[file.item.scope]}</span></span>,
      textValue: file.name + ' ' + scopeToLabelMap[file.item.scope],
      presence: presence
        .filter(p => p.project === file.item.teamProjectId && p.file === file.id)
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
      id: file.id,
      icon: <span className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} rounded aspect-square h-6 flex items-center justify-center`}><Icon icon={scopeToIconMap[file.item.scope]} className="w-4" /></span>,
      name: file.name,
      description: <span className='flex items-center gap-1'><span className='px-2 text-[--hl]'>{scopeToLabelMap[file.item.scope]}</span>{file.organizationName}<span>/</span>{file.projectName}</span>,
      textValue: file.name + ' ' + scopeToLabelMap[file.item.scope],
      presence: presence
        .filter(p => p.project === file.item.teamProjectId && p.file === file.id)
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
      if (pullFileFetcher.data?.error) {
        showAlert({
          title: 'Error',
          message: pullFileFetcher.data.error,
        });
      }

      close();
    }

    prevPullFetcherState.current = pullFileFetcher.state;
  }, [close, pullFileFetcher]);

  // Close the dialog when the environment is set
  // If we close the dialog when fetcher.submit() is done then the dialog will close before the environment is set
  // The update env will run but the loaders on the page will not be revalidated. https://github.com/remix-run/remix/discussions/9020
  const prevEnvFetcherState = useRef(setActiveEnvironmentFetcher.state);
  useEffect(() => {
    if (setActiveEnvironmentFetcher.state === 'idle' && prevEnvFetcherState.current !== 'idle') {
      close();
    }

    prevEnvFetcherState.current = setActiveEnvironmentFetcher.state;
  }, [close, setActiveEnvironmentFetcher.state]);

  const isPullingFile = pullFileFetcher.state !== 'idle';
  const pullingFileBackedProjectId = pullFileFetcher.formData?.get('backendProjectId');
  const pullingFile = remoteFiles.find(file => file.item.projectId === pullingFileBackedProjectId);

  return (
    <ComboBox
      aria-label='Quick switcher'
      className='group overflow-hidden'
      isDisabled={isPullingFile}
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
      {({ isOpen }) => {
        return (
          <>
            <Label
              aria-label="Filter"
              className="group relative flex items-center flex-1 pt-0"
            >
              {isPullingFile ? (
                <>
                  <Icon icon="spinner" className="text-[--color-font] absolute left-4 animate-spin" />
                  <div
                    slot='input'
                    className="py-3 pl-10 pr-7 w-full bg-[--color-bg] transition-none text-[--color-font] rounded-md group-data-[open]:rounded-b-none border border-solid border-[--hl-sm]"
                  >
                    Pulling: {pullingFile?.name}
                  </div>
                </>
              ) : (
                <>
                    <Icon icon="search" className="text-[--color-font] absolute left-4" />
                    <Input
                      slot='input'
                      placeholder="Search and switch between requests, collections and documents"
                      className="py-3 pl-10 pr-7 w-full bg-[--color-bg] transition-none text-[--color-font] rounded-md group-data-[open]:rounded-b-none border border-solid border-[--hl-sm]"
                    />
                </>
              )}
            </Label>
            <Popover offset={0} className={`outline-none rounded-b-md w-[--trigger-width] bg-[--color-bg] text-[--color-font] relative overflow-y-auto flex-1 border ${isOpen ? 'border-solid' : ''} border-[--hl-sm]`}>
                <ListBox
                  aria-label='Commands'
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
            </Popover>
          </>
        );
      }}

    </ComboBox>
  );
};
