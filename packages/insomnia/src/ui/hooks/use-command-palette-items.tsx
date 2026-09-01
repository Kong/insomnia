import type { CommandSearchResult } from 'insomnia-data';
import { models } from 'insomnia-data';
import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { useRootLoaderData } from '~/root';
import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
import { useSetActiveEnvironmentFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active';
import { useRemoteFilesLoaderFetcher } from '~/routes/remote-files';
import { AvatarGroup } from '~/ui/components/avatar';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useCommandSearch } from '~/ui/hooks/use-command-search';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { isPrimaryClickModifier } from '~/ui/utils';

const { isRequest } = models.request;
const { isRequestGroup } = models.requestGroup;

export interface CommandPaletteItem {
  id: string;
  icon: React.ReactNode;
  name: string;
  presence: { key: string; alt: string; src: string }[];
  description: React.ReactNode;
  textValue: string;
  openInNewTab?: () => void;
  action: (withTab?: boolean) => void;
}

export interface CommandPaletteSection {
  id: string;
  name: string;
  children: CommandPaletteItem[];
}

// Shared data/behavior for the command palette, decoupled from the ComboBox rendering layer
// so we can swap the react-aria ComboBox for a plain implementation to isolate INS command-palette-freeze bugs.
export function useCommandPaletteItems({ close }: { close: () => void }) {
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

  const remoteFilesLoader = useRemoteFilesLoaderFetcher();

  const {
    results: searchResults,
    isSearching,
    inputValue,
    search,
    abort,
  } = useCommandSearch({
    accountId,
    organizationId,
    projectId,
    workspaceId,
  });

  const closeWithAbort = useCallback(() => {
    abort();
    close();
  }, [abort, close]);

  useEffect(() => {
    if (!remoteFilesLoader.data && remoteFilesLoader.state === 'idle') {
      remoteFilesLoader.load();
    }
  }, [remoteFilesLoader]);

  const isLoadingComboboxItems = isSearching || remoteFilesLoader.state !== 'idle';

  type CommandRequest = CommandSearchResult['current']['requests'][number];

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
        closeWithAbort();
      },
    };
  };

  type CommandFile = CommandSearchResult['current']['files'][number] | CommandSearchResult['other']['files'][number];

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
        closeWithAbort();
      },
    };
  };

  const comboboxSections: CommandPaletteSection[] = [];

  const currentRequests =
    searchResults?.current.requests.map(request => ({
      ...request,
      ...getRequestHandlers(request),
    })) || [];

  const remoteFiles = remoteFilesLoader.data?.files || [];
  const remoteFileMatchesFilter = (file: { name: string }) =>
    !inputValue || file.name.toLowerCase().includes(inputValue.toLowerCase());

  const currentFilesData = searchResults?.current.files || [];
  const currentRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId === projectId)
    .filter(file => !currentFilesData.some(f => f.id === file.item.id))
    .filter(remoteFileMatchesFilter);

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
        closeWithAbort();
      },
    })) || [];

  const currentFiles = [...currentLocalFiles, ...currentRemoteFiles];

  const currentEnvironments =
    searchResults?.current.environments.map(environment => ({
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
    searchResults?.other.requests.map(request => ({
      ...request,
      ...getRequestHandlers(request),
    })) || [];

  const otherFilesData = searchResults?.other.files || [];
  const otherRemoteFilesData = remoteFiles
    .filter(file => file.item.teamProjectLocalId !== projectId)
    .filter(file => !otherFilesData.some(f => f.id === file.item.id))
    .filter(remoteFileMatchesFilter);

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
        closeWithAbort();
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
                QUERY: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
              }[request.item.method] || 'bg-(--hl-md) text-(--color-font)'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : models.webSocketRequest.isWebSocketRequest(request.item) ? (
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
        textValue: `${isRequest(request.item) ? request.item.method : models.webSocketRequest.isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name}`,
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
                QUERY: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
              }[request.item.method] || 'bg-(--hl-md) text-(--color-font)'
            }`}
          >
            {getMethodShortHand(request.item)}
          </span>
        ) : models.webSocketRequest.isWebSocketRequest(request.item) ? (
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
          ? `${isRequest(request.item) ? request.item.method : models.webSocketRequest.isWebSocketRequest(request.item) ? 'WebSocket' : 'gRPC'} ${request.name}`
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

      closeWithAbort();
    }

    prevPullFetcherState.current = pullFileFetcher.state;
  }, [closeWithAbort, pullFileFetcher]);

  // Close the dialog when the environment is set
  // If we close the dialog when fetcher.submit() is done then the dialog will close before the environment is set
  // The update env will run but the loaders on the page will not be revalidated. https://github.com/remix-run/remix/discussions/9020
  const prevEnvFetcherState = useRef(setActiveEnvironmentFetcher.state);
  useEffect(() => {
    if (setActiveEnvironmentFetcher.state === 'idle' && prevEnvFetcherState.current !== 'idle') {
      closeWithAbort();
    }

    prevEnvFetcherState.current = setActiveEnvironmentFetcher.state;
  }, [closeWithAbort, setActiveEnvironmentFetcher.state]);

  const isPullingFile = pullFileFetcher.state !== 'idle';
  const pullingFileBackedProjectId = pullFileFetcher.formData?.get('backendProjectId');
  const pullingFile = remoteFiles.find(file => file.item.projectId === pullingFileBackedProjectId);

  return {
    organizationId,
    workspaceId,
    requestId,
    comboboxSections,
    isLoadingComboboxItems,
    inputValue,
    search,
    closeWithAbort,
    isPullingFile,
    pullingFile,
    isPrimaryClickModifier,
    AvatarGroup,
  };
}
