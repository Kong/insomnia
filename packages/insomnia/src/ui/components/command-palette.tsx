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
  ListBoxSection,
  Modal,
  ModalOverlay,
  Popover,
  Text,
} from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';

import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from '~/common/hotkeys';
import { models } from '~/insomnia-data';
import { isRequest } from '~/models/request';
import { isRequestGroup } from '~/models/request-group';
import { isWebSocketRequest } from '~/models/websocket-request';
import { useRootLoaderData } from '~/root';
import { useCommandsLoaderFetcher } from '~/routes/commands';
import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
import { useSetActiveEnvironmentFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active';
import { useRemoteFilesLoaderFetcher } from '~/routes/remote-files';
import { SegmentEvent } from '~/ui/analytics';
import { AvatarGroup } from '~/ui/components/avatar';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { isPrimaryClickModifier } from '~/ui/utils';

export const CommandPalette = memo(function CommandPalette({ style = {} }: { style?: React.CSSProperties }) {
  const [isOpen, setIsOpen] = useState(false);
  const { settings } = useRootLoaderData()!;

  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
      window.main.trackSegmentEvent({
        event: SegmentEvent.quickSearchOpenedByKeyboard,
      });
    },
  });

  const requestSwitchKeyCombination = getPlatformKeyCombinations(settings.hotKeyRegistry.request_quickSwitch)[0];

  return (
    <DialogTrigger
      onOpenChange={isOpen => {
        setIsOpen(isOpen);
        if (isOpen) {
          window.main.trackSegmentEvent({
            event: SegmentEvent.quickSearchOpenedByMouse,
          });
        }
      }}
      isOpen={isOpen}
    >
      <Button
        style={{ ...style }}
        data-testid="quick-search"
        className="flex h-[30.5px] shrink-0 items-center justify-between gap-2 rounded-md bg-(--hl-xs) px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all ring-inset hover:bg-(--hl-xs) focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-sm)"
      >
        <div>
          <Icon icon="search" className="mr-2" />
          Search..
        </div>
        {requestSwitchKeyCombination && (
          <Keyboard className="inline-block items-center space-x-0.5 rounded-md bg-(--hl-xs) px-2 py-0.5 text-center font-sans text-sm font-normal text-(--hl) shadow-xs">
            {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
          </Keyboard>
        )}
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full justify-center bg-black/30 pt-20"
      >
        <Modal className="w-full max-w-3xl">
          <Dialog aria-label="Command palette dialog" className="outline-hidden">
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

  const { userSession } = useRootLoaderData()!;
  const { presence } = useInsomniaEventStreamContext();
  const pullFileFetcher = useInsomniaSyncPullRemoteFileActionFetcher();
  const setActiveEnvironmentFetcher = useSetActiveEnvironmentFetcher();

  const navigate = useNavigate();
  const tabNavigate = useTabNavigate();

  const accountId = userSession.accountId;

  const commandsLoader = useCommandsLoaderFetcher();

  const remoteFilesLoader = useRemoteFilesLoaderFetcher();

  useEffect(() => {
    if (!commandsLoader.data && commandsLoader.state === 'idle') {
      commandsLoader.load({
        organizationId,
        projectId,
        workspaceId,
      });
    }
  }, [commandsLoader, organizationId, projectId, workspaceId]);

  useEffect(() => {
    if (!remoteFilesLoader.data && remoteFilesLoader.state === 'idle') {
      remoteFilesLoader.load();
    }
  }, [remoteFilesLoader]);

  const isLoadingComboboxItems = commandsLoader.state !== 'idle' || remoteFilesLoader.state !== 'idle';

  type CommandRequest = NonNullable<typeof commandsLoader.data>['current']['requests'][number];

  const getRequestHandlers = (request: CommandRequest) => {
    const navigateInfo = {
      organization: request.organizationId,
      project: {
        _id: request.projectId,
        name: request.projectName,
      },
      workspace: {
        _id: request.workspaceId,
        name: request.workspaceName,
      },
      item: request.item,
    };

    return {
      openInNewTab:
        request.organizationId === organizationId
          ? () => {
              tabNavigate(navigateInfo, {
                withTab: true,
              });
            }
          : undefined,
      action: (withTab?: boolean) => {
        withTab = withTab && request.organizationId === organizationId;
        tabNavigate(navigateInfo, {
          shouldNavigate: true,
          withTab,
        });
        close();
      },
    };
  };

  type CommandFile =
    | NonNullable<typeof commandsLoader.data>['current']['files'][number]
    | NonNullable<typeof commandsLoader.data>['other']['files'][number];

  const getFileHandlers = (file: CommandFile) => {
    const navigationInfo = {
      organization: file.organizationId,
      project: {
        _id: file.projectId,
        name: file.projectName,
      },
      workspace: {
        _id: file.id,
        name: file.name,
      },
      item: file.item,
    };

    return {
      openInNewTab:
        file.organizationId === organizationId
          ? () => {
              tabNavigate(navigationInfo, { withTab: true });
            }
          : undefined,
      action: (withTab?: boolean) => {
        withTab = withTab && file.organizationId === organizationId;
        tabNavigate(navigationInfo, {
          shouldNavigate: true,
          withTab,
        });
        close();
      },
    };
  };

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
      openInNewTab?: () => void;
      action: (withTab?: boolean) => void;
    }[];
  }[] = [];

  const currentRequests =
    commandsLoader.data?.current.requests.map(request => ({
      ...request,
      ...getRequestHandlers(request),
    })) || [];

  const remoteFiles = remoteFilesLoader.data?.files || [];

  const currentFilesData = commandsLoader.data?.current.files || [];
  const currentRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId === projectId)
    .filter(file => !currentFilesData.some(f => f.id === file.item.id));

  const currentLocalFiles =
    currentFilesData?.map(file => ({
      ...file,
      ...getFileHandlers(file),
    })) || [];

  const currentRemoteFiles =
    currentRemoteFilesData?.map(file => ({
      ...file,
      action: async () => {
        await pullFileFetcher.submit({
          backendProjectId: file.item.projectId,
          remoteId: file.item.teamProjectId,
          organizationId: file.item.organizationId,
        });

        navigate(file.url);
        close();
      },
    })) || [];

  const currentFiles = [...currentLocalFiles, ...currentRemoteFiles];

  const currentEnvironments =
    commandsLoader.data?.current.environments.map(environment => ({
      ...environment,
      id: environment._id,
      action: async () => {
        await setActiveEnvironmentFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          environmentId: environment._id,
        });
      },
    })) || [];

  const otherRequests =
    commandsLoader.data?.other.requests.map(request => ({
      ...request,
      ...getRequestHandlers(request),
    })) || [];

  const otherFilesData = commandsLoader.data?.other.files || [];
  const otherRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId !== projectId)
    .filter(file => !otherFilesData.some(f => f.id === file.item.id));

  const otherLocalFiles =
    otherFilesData.map(file => ({
      ...file,
      ...getFileHandlers(file),
    })) || [];

  const otherRemoteFiles =
    otherRemoteFilesData.map(file => ({
      ...file,
      action: async () => {
        await pullFileFetcher.submit({
          backendProjectId: file.item.projectId,
          remoteId: file.item.teamProjectId,
          organizationId: file.item.organizationId,
        });

        navigate(file.url);
        close();
      },
    })) || [];

  const otherFiles = [...otherLocalFiles, ...otherRemoteFiles];

  currentRequests.length > 0 &&
    comboboxSections.push({
      id: 'current-requests',
      name: 'Requests',
      children: currentRequests.map(request => ({
        id: request.item._id,
        icon: isRequest(request.item) ? (
          <span
            className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
              }[request.item.method] || 'bg-(--hl-md) text-(--color-font)'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : isWebSocketRequest(request.item) ? (
          <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
            WS
          </span>
        ) : (
          models.grpcRequest.isGrpcRequest(request.item) && (
            <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
              gRPC
            </span>
          )
        ),
        name: request.name,
        presence: [],
        description: request.item.url,
        textValue: `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name}`,
        openInNewTab: request.openInNewTab,
        action: request.action,
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
            className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} flex aspect-square h-6 items-center justify-center rounded-sm`}
          >
            <Icon icon={scopeToIconMap[file.item.scope]} className="w-4" />
          </span>
        ),
        name: file.name,
        description: (
          <span className="flex items-center gap-1">
            <span className="px-2 text-(--hl)">{scopeToLabelMap[file.item.scope]}</span>
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
        openInNewTab: 'openInNewTab' in file ? file.openInNewTab : undefined,
        action: file.action,
      })),
    });

  currentEnvironments.length > 0 &&
    comboboxSections.push({
      id: 'environments',
      name: 'Environments',
      children: currentEnvironments.map(environment => ({
        id: environment._id,
        icon: (
          <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-(--hl-md) py-1 text-[0.65rem] text-(--color-font)">
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
        action: environment.action,
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
            className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
              {
                GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
                HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
              }[request.item.method] || 'bg-(--hl-md) text-(--color-font)'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : isWebSocketRequest(request.item) ? (
          <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
            WS
          </span>
        ) : (
          models.grpcRequest.isGrpcRequest(request.item) && (
            <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
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
          ? `${isRequest(request.item) ? request.item.method : isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name}`
          : '',
        openInNewTab: 'openInNewTab' in request ? request.openInNewTab : undefined,
        action: request.action,
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
            className={`${scopeToBgColorMap[file.item.scope]} ${scopeToTextColorMap[file.item.scope]} flex aspect-square h-6 items-center justify-center rounded-sm`}
          >
            <Icon icon={scopeToIconMap[file.item.scope]} className="w-4" />
          </span>
        ),
        name: file.name,
        description: (
          <span className="flex items-center gap-1">
            <span className="px-2 text-(--hl)">{scopeToLabelMap[file.item.scope]}</span>
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
        openInNewTab: 'openInNewTab' in file ? file.openInNewTab : undefined,
        action: file.action,
      })),
    });

  const prevPullFetcherState = useRef(pullFileFetcher.state);
  useEffect(() => {
    if (pullFileFetcher.state === 'idle' && prevPullFetcherState.current !== 'idle') {
      if (pullFileFetcher.data?.error) {
        showModal(AlertModal, {
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
        commandsLoader.load({
          organizationId,
          projectId,
          workspaceId,
          filter,
        });
      }}
      // By default, Escape would just clear the input field. We need to press twice to close the dialog.
      onKeyDown={e => {
        if (e.key === 'Escape') {
          close();
        }
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

        item?.action();
      }}
    >
      {({ isOpen }) => {
        return (
          <>
            <Label aria-label="Filter" className="group relative flex flex-1 items-center pt-0">
              {isPullingFile ? (
                <>
                  <Icon icon="spinner" className="absolute left-4 animate-spin text-(--color-font)" />
                  <div
                    slot="input"
                    className="w-full rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-3 pr-7 pl-10 text-(--color-font) transition-none group-data-open:rounded-b-none"
                  >
                    Pulling: {pullingFile?.name}
                  </div>
                </>
              ) : (
                <>
                  {isLoadingComboboxItems ? (
                    <Icon icon="spinner" className="absolute left-4 animate-spin text-(--color-font)" />
                  ) : (
                    <Icon icon="search" className="absolute left-4 text-(--color-font)" />
                  )}
                  <Input
                    slot="input"
                    readOnly={isLoadingComboboxItems}
                    placeholder={
                      isLoadingComboboxItems
                        ? 'Loading...'
                        : 'Search and switch between requests, collections and documents'
                    }
                    className="w-full rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-3 pr-7 pl-10 text-(--color-font) transition-none group-data-open:rounded-b-none"
                  />
                </>
              )}
            </Label>
            <Popover
              offset={0}
              className={`relative w-(--trigger-width) flex-1 overflow-y-auto rounded-b-md border bg-(--color-bg) text-(--color-font) outline-hidden ${isOpen ? 'border-solid' : ''} border-(--hl-sm)`}
            >
              <ListBox
                aria-label="Commands"
                className="relative flex-1 overflow-y-auto outline-hidden"
                items={comboboxSections}
              >
                {section => (
                  <ListBoxSection className="flex flex-1 flex-col">
                    <Header className="p-2 text-xs text-(--hl) uppercase select-none">{section.name}</Header>
                    <Collection items={section.children}>
                      {item => (
                        <ListBoxItem textValue={item.textValue} className="group outline-hidden select-none">
                          <div
                            className={`flex outline-hidden select-none ${item.id === workspaceId || item.id === requestId ? 'font-bold text-(--color-font)' : 'text-(--hl)'} relative h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 transition-colors group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font) group-data-focused:bg-(--hl-sm)`}
                            // Avoid ListBoxItem onSelect getting triggered and focus stealing by the button
                            onMouseDownCapture={e => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onPointerDown={e => e.stopPropagation()}
                            onPointerUp={e => e.stopPropagation()}
                            onClick={e => {
                              item.action(isPrimaryClickModifier(e));
                            }}
                          >
                            {item.icon}
                            <Text className="shrink-0 truncate px-1" slot="label">
                              {item.name}
                            </Text>
                            {item.presence.length > 0 && (
                              <span className="w-[70px]">
                                <AvatarGroup size="small" maxAvatars={3} items={item.presence} />
                              </span>
                            )}
                            <Text className="flex-1 truncate px-1 text-sm text-(--hl-md)" slot="description">
                              {item.description}
                            </Text>
                            {item.openInNewTab && (
                              <button
                                aria-label="Open in New Tab"
                                className="shrink-0 rounded-sm bg-(--hl-xs) px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-sm)"
                                onClick={e => {
                                  e.stopPropagation();
                                  item.openInNewTab?.();
                                }}
                              >
                                Open In New Tab <Icon icon="external-link-alt" className="w-3" />
                              </button>
                            )}
                          </div>
                        </ListBoxItem>
                      )}
                    </Collection>
                  </ListBoxSection>
                )}
              </ListBox>
            </Popover>
          </>
        );
      }}
    </ComboBox>
  );
};
