import React, { memo, useEffect, useRef } from 'react';
import { useState } from 'react';
import {
  Button,
  Collection,
  ComboBox,
  Dialog,
  DialogTrigger,
  Header,
  Input,
  Keyboard,
  Label,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  Popover,
  Section,
  Text,
} from 'react-aria-components';
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
    <DialogTrigger onOpenChange={setIsOpen} isOpen={isOpen}>
      <Button
        style={{ ...style }}
        data-testid="quick-search"
        className="flex h-[30.5px] flex-shrink-0 items-center justify-between gap-2 rounded-md bg-[--hl-xs] px-4 py-1 text-sm text-[--color-font] ring-1 ring-inset ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-sm]"
      >
        <div>
          <Icon icon="search" className="mr-2" />
          Search..
        </div>
        {requestSwitchKeyCombination && (
          <Keyboard className="inline-block items-center space-x-0.5 rounded-md bg-[--hl-xs] px-2 py-0.5 text-center font-sans text-sm font-normal text-[--hl] shadow-sm">
            {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
          </Keyboard>
        )}
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full justify-center bg-black/30 pt-20"
      >
        <Modal className="w-full max-w-3xl">
          <Dialog aria-label="Command palette dialog" className="outline-none">
            {({ close }) => <CommandPaletteCombobox close={close} />}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
});

const CommandPaletteCombobox = ({ close }: { close: () => void }) => {
  const { organizationId, projectId, workspaceId, requestId } = useParams() as {
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

  const currentRequests =
    commandsLoader.data?.current.requests.map(request => ({
      ...request,
      action: () => {
        navigate(request.url);
      },
    })) || [];

  const remoteFiles = remoteFilesLoader.data?.files || [];

  const currentFilesData = commandsLoader.data?.current.files || [];
  const currentRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId === projectId)
    .filter(file => !currentFilesData.some(f => f.id === file.item.id));

  const currentFiles =
    [...currentFilesData, ...currentRemoteFilesData]?.map(file => ({
      ...file,
      action: () => {
        if ('pullUrl' in file && file.pullUrl) {
          pullFileFetcher.submit(
            { backendProjectId: file.item.projectId, remoteId: file.item.teamProjectId },
            {
              method: 'POST',
              action: file.pullUrl,
            },
          );

          return true;
        }
        navigate(file.url);
        return null;
      },
    })) || [];

  const currentEnvironments =
    commandsLoader.data?.current.environments.map(environment => ({
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
          },
        );

        return true;
      },
    })) || [];

  const otherRequests =
    commandsLoader.data?.other.requests.map(request => ({
      ...request,
      action: () => {
        navigate(request.url);
      },
    })) || [];

  const otherFilesData = commandsLoader.data?.other.files || [];
  const otherRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId !== projectId)
    .filter(file => !otherFilesData.some(f => f.id === file.item.id));

  const otherFiles =
    [...otherFilesData, ...otherRemoteFilesData].map(file => ({
      ...file,
      action: () => {
        if ('pullUrl' in file && file.pullUrl) {
          pullFileFetcher.submit(
            { backendProjectId: file.item.projectId, remoteId: file.item.teamProjectId },
            {
              method: 'POST',
              action: file.pullUrl,
            },
          );

          return true;
        }
        navigate(file.url);
        return null;
      },
    })) || [];

  currentRequests.length > 0 &&
    comboboxSections.push({
      id: 'current-requests',
      name: 'Requests',
      children: currentRequests.map(request => ({
        id: request.item._id,
        icon: isRequest(request.item) ? (
          <span
            className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-[--color-font-surprise]',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-[--color-font-success]',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-[--color-font-danger]',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-[--color-font-warning]',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-[--color-font-notice]',
              }[request.item.method] || 'bg-[--hl-md] text-[--color-font]'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : isWebSocketRequest(request.item) ? (
          <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-[--color-font-notice]">
            WS
          </span>
        ) : (
          isGrpcRequest(request.item) && (
            <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
              gRPC
            </span>
          )
        ),
        name: request.name,
        presence: [],
        description: request.item.url,
        textValue: `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name} ${request.url}`,
      })),
    });

  currentFiles.length > 0 &&
    comboboxSections.push({
      id: 'collections-and-documents',
      name: 'Collections and documents',
      children: currentFiles.map(file => ({
        id: file.id,
        icon: (
          <span
            className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} flex aspect-square h-6 items-center justify-center rounded`}
          >
            <Icon icon={scopeToIconMap[file.item.scope]} className="w-4" />
          </span>
        ),
        name: file.name,
        description: (
          <span className="flex items-center gap-1">
            <span className="px-2 text-[--hl]">{scopeToLabelMap[file.item.scope]}</span>
          </span>
        ),
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

  currentEnvironments.length > 0 &&
    comboboxSections.push({
      id: 'environments',
      name: 'Environments',
      children: currentEnvironments.map(environment => ({
        id: environment._id,
        icon: (
          <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[--hl-md] py-1 text-[0.65rem] text-[--color-font]">
            <Icon
              icon={environment.isPrivate ? 'laptop-code' : 'globe-americas'}
              className="w-5 text-xs"
              style={{
                color: environment.color ?? 'var(--color-font)',
              }}
            />
          </span>
        ),
        name: environment.name,
        presence: [],
        description: `${environment.isPrivate ? 'Private' : 'Shared'} environment`,
        textValue: environment.name,
      })),
    });

  otherRequests.length > 0 &&
    comboboxSections.push({
      id: 'other-requests',
      name: 'Other Requests',
      children: otherRequests.map(request => ({
        id: request.item._id,
        icon: isRequest(request.item) ? (
          <span
            className={`flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-[--color-font-surprise]',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-[--color-font-success]',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-[--color-font-info]',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-[--color-font-danger]',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-[--color-font-warning]',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-[--color-font-notice]',
              }[request.item.method] || 'bg-[--hl-md] text-[--color-font]'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : isWebSocketRequest(request.item) ? (
          <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-[--color-font-notice]">
            WS
          </span>
        ) : (
          isGrpcRequest(request.item) && (
            <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
              gRPC
            </span>
          )
        ),
        name: request.name,
        presence: [],
        description: (
          <span className="flex items-center gap-1">
            {request.organizationName}
            <span>/</span>
            {request.projectName}
            <span>/</span>
            {request.workspaceName}
          </span>
        ),
        textValue: !isRequestGroup(request.item)
          ? `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name} ${request.url}`
          : '',
      })),
    });

  otherFiles.length > 0 &&
    comboboxSections.push({
      id: 'other-collections-and-documents',
      name: 'Other collections and documents',
      children: otherFiles.map(file => ({
        id: file.id,
        icon: (
          <span
            className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} flex aspect-square h-6 items-center justify-center rounded`}
          >
            <Icon icon={scopeToIconMap[file.item.scope]} className="w-4" />
          </span>
        ),
        name: file.name,
        description: (
          <span className="flex items-center gap-1">
            <span className="px-2 text-[--hl]">{scopeToLabelMap[file.item.scope]}</span>
            {file.organizationName}
            <span>/</span>
            {file.projectName}
          </span>
        ),
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
      aria-label="Quick switcher"
      className="group overflow-hidden"
      isDisabled={isPullingFile}
      autoFocus
      allowsCustomValue={false}
      menuTrigger="focus"
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
        return Boolean(fuzzyMatch(filter, textValue, { splitSpace: false, loose: true })?.indexes);
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
            <Label aria-label="Filter" className="group relative flex flex-1 items-center pt-0">
              {isPullingFile ? (
                <>
                  <Icon icon="spinner" className="absolute left-4 animate-spin text-[--color-font]" />
                  <div
                    slot="input"
                    className="w-full rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-3 pl-10 pr-7 text-[--color-font] transition-none group-data-[open]:rounded-b-none"
                  >
                    Pulling: {pullingFile?.name}
                  </div>
                </>
              ) : (
                <>
                  <Icon icon="search" className="absolute left-4 text-[--color-font]" />
                  <Input
                    slot="input"
                    placeholder="Search and switch between requests, collections and documents"
                    className="w-full rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-3 pl-10 pr-7 text-[--color-font] transition-none group-data-[open]:rounded-b-none"
                  />
                </>
              )}
            </Label>
            <Popover
              offset={0}
              className={`relative w-[--trigger-width] flex-1 overflow-y-auto rounded-b-md border bg-[--color-bg] text-[--color-font] outline-none ${isOpen ? 'border-solid' : ''} border-[--hl-sm]`}
            >
              <ListBox
                aria-label="Commands"
                className="relative flex-1 overflow-y-auto outline-none"
                items={comboboxSections}
              >
                {section => (
                  <Section className="flex flex-1 flex-col">
                    <Header className="select-none p-2 text-xs uppercase text-[--hl]">{section.name}</Header>
                    <Collection items={section.children}>
                      {item => (
                        <ListBoxItem textValue={item.textValue} className="group select-none outline-none">
                          <div
                            className={`flex select-none outline-none ${item.id === workspaceId || item.id === requestId ? 'font-bold text-[--color-font]' : 'text-[--hl]'} relative h-[--line-height-xs] w-full items-center gap-2 overflow-hidden px-4 transition-colors group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] group-aria-selected:text-[--color-font] group-data-[focused]:bg-[--hl-sm]`}
                          >
                            {item.icon}
                            <Text className="flex-shrink-0 truncate px-1" slot="label">
                              {item.name}
                            </Text>
                            {item.presence.length > 0 && (
                              <span className="w-[70px]">
                                <AvatarGroup size="small" maxAvatars={3} items={item.presence} />
                              </span>
                            )}
                            <Text className="flex-1 truncate px-1 text-sm text-[--hl-md]" slot="description">
                              {item.description}
                            </Text>
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
