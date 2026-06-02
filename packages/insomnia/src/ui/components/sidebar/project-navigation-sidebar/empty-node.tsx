import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { StorageRules } from 'insomnia-api';
import { useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import type { WorkspaceScope } from '~/insomnia-data';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { showModal } from '~/ui/components/modals';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import type { CreateRequestType } from '~/ui/hooks/use-request';

import { Icon } from '../../icon';
import { GUIDE_LINE_CSS, ROW_CLASS } from './project-navigation-sidebar-utils';
import type { EmptyNodeFlatItem } from './types';

interface EmptyNodeProps {
  item: EmptyNodeFlatItem;
  storageRules: StorageRules;
}

interface ActionItem {
  id: string;
  name: string;
  icon: IconProp;
  action: () => void;
}

export const EmptyNode = ({ item, storageRules }: EmptyNodeProps) => {
  const { organizationId, project, workspace, requestGroup, level = 0, kind } = item;
  const [newWorkspaceModalState, setNewWorkspaceModalState] = useState<{
    scope: WorkspaceScope;
    isOpen: boolean;
    source?: string;
  } | null>({
    scope: 'collection',
    isOpen: false,
  });
  const createNewCollection = () => setNewWorkspaceModalState({ scope: 'collection', isOpen: true, source: 'sidebar' });
  const createNewDocument = () => setNewWorkspaceModalState({ scope: 'design', isOpen: true, source: 'sidebar' });
  const createNewMockServer = () => setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true, source: 'sidebar' });
  const createNewGlobalEnvironment = () => setNewWorkspaceModalState({ scope: 'environment', isOpen: true, source: 'sidebar' });
  const createNewMcpClient = () => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true, source: 'sidebar' });

  const newRequestFetcher = useRequestNewActionFetcher();
  const newRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const parentId = requestGroup?._id || workspace?._id || project._id;

  const createRequest = ({ requestType }: { requestType: CreateRequestType }) => {
    if (!workspace) return;
    newRequestFetcher.submit({
      organizationId,
      projectId: project._id,
      workspaceId: workspace._id,
      requestType,
      parentId,
    });
  };

  const createFolder = () => {
    if (!workspace) return;
    showModal(PromptModal, {
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: (name: string) =>
        newRequestGroupFetcher.submit({
          organizationId,
          projectId: project._id,
          workspaceId: workspace._id,
          parentId,
          name,
        }),
    });
  };

  const createRequestActionItems: ActionItem[] = [
    {
      id: 'HTTP',
      name: 'HTTP Request',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'HTTP',
        }),
    },
    {
      id: 'Event Stream',
      name: 'Event Stream Request (SSE)',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'Event Stream',
        }),
    },
    {
      id: 'GraphQL Request',
      name: 'GraphQL Request',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'GraphQL',
        }),
    },
    {
      id: 'gRPC Request',
      name: 'gRPC Request',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'gRPC',
        }),
    },
    {
      id: 'WebSocket Request',
      name: 'WebSocket Request',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'WebSocket',
        }),
    },
    {
      id: 'Socket.IO Request',
      name: 'Socket.IO Request',
      icon: 'plus-circle',
      action: () =>
        createRequest({
          requestType: 'SocketIO',
        }),
    },
    {
      id: 'New Folder',
      name: 'New Folder',
      icon: 'folder',
      action: createFolder,
    },
  ];

  const createInProjectActionList: ActionItem[] = [
    {
      id: 'new-collection',
      name: 'Request collection',
      icon: 'bars',
      action: createNewCollection,
    },
    {
      id: 'new-document',
      name: 'Design document',
      icon: 'file',
      action: createNewDocument,
    },
    {
      id: 'new-mcp-client',
      name: 'MCP Client',
      icon: ['fac', 'mcp'] as unknown as IconProp,
      action: createNewMcpClient,
    },

    {
      id: 'new-mock-server',
      name: 'Mock Server',
      icon: 'server' as IconName,
      action: createNewMockServer,
    },

    {
      id: 'new-environment',
      name: 'Environment',
      icon: 'code',
      action: createNewGlobalEnvironment,
    },
  ];

  const getLabel = () => {
    switch (kind) {
      case 'emptyProject': {
        return 'Project is empty';
      }
      case 'emptyCollection': {
        return 'Collection is empty';
      }
      case 'emptyFolder': {
        return 'Folder is empty';
      }
      default: {
        return '';
      }
    }
  };

  const getAriaLabel = () => {
    switch (kind) {
      case 'emptyProject': {
        return 'empty project';
      }
      case 'emptyCollection': {
        return 'empty collection';
      }
      case 'emptyFolder': {
        return 'empty folder';
      }
      default: {
        return '';
      }
    }
  };

  const paddingLeft = kind === 'emptyProject' ? '2em' : `${level + 3}rem`;

  return (
    <div className={ROW_CLASS} style={{ paddingLeft }} data-testid={`empty-node-${kind}`}>
      <Button slot="drag" className="hidden" />
      <span className={`${GUIDE_LINE_CSS} left-6 group-hover/tree:bg-(--hl-sm)`} />
      {kind !== 'emptyProject' && <span className={`${GUIDE_LINE_CSS} left-10 group-hover/tree:bg-(--hl-sm)`} />}
      {kind === 'emptyFolder' &&
        Array.from({ length: level + 2 }, (_, i) => (
          <span
            key={i}
            className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`}
            style={{ left: `${i + 1.5}em` }}
          />
        ))}
      <span className={`${kind === 'emptyFolder' ? 'ml-7' : 'ml-3'} min-w-0 flex-1 truncate text-sm`}>
        {getLabel()}
      </span>
      <MenuTrigger>
        <Button
          aria-label={`Create in ${getAriaLabel()}`}
          className="flex items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-md) bg-(--hl-xxs) p-1.5 px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="plus" /> <span className="hidden md:block">Create</span>
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden">
          <Menu
            aria-label={`Create in ${getAriaLabel()} actions`}
            selectionMode="single"
            onAction={key => {
              const item = (kind === 'emptyProject' ? createInProjectActionList : createRequestActionItems).find(
                item => item.id === key,
              );
              if (item) {
                item.action();
              }
            }}
            items={kind === 'emptyProject' ? createInProjectActionList : createRequestActionItems}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-base shadow-lg select-none focus:outline-hidden"
          >
            {item => (
              <MenuItem
                key={item.id}
                id={item.id}
                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                aria-label={item.name}
              >
                <Icon icon={item.icon} />
                <span>{item.name}</span>
              </MenuItem>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {newWorkspaceModalState?.isOpen && (
        <NewWorkspaceModal
          isOpen
          project={project}
          storageRules={storageRules}
          scope={newWorkspaceModalState.scope}
          source={newWorkspaceModalState.source}
          onOpenChange={isOpen => {
            setNewWorkspaceModalState({
              scope: newWorkspaceModalState.scope,
              isOpen,
            });
          }}
        />
      )}
    </div>
  );
};
