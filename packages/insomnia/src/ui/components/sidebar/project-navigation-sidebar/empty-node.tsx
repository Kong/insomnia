import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { StorageRules } from 'insomnia-api';
import type { WorkspaceScope } from 'insomnia-data';
import { useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import { scopeToBgColorMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { createRequestOrFolderActionItems } from '~/ui/components/dropdowns/actions/create-actions';
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
  // Number of ancestor indent levels to strip (see RequestNode) for collection-focus mode.
  depthOffset?: number;
}

interface ActionItem {
  id: string;
  name: string;
  icon: IconProp;
  scope?: WorkspaceScope;
  action: () => void;
}

// Shared "+ Create" button for a collection: offers creating a folder or a
// request of any type, mirroring the collection context menu. Used both in the
// empty-collection/empty-folder rows and in the collection-focus sidebar header
// so the two stay identical.
export const CollectionCreateButton = ({
  organizationId,
  projectId,
  workspaceId,
  parentId,
  ariaLabel = 'Create request or folder',
}: {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  parentId?: string;
  ariaLabel?: string;
}) => {
  const newRequestFetcher = useRequestNewActionFetcher();
  const newRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const targetParentId = parentId ?? workspaceId;

  const createRequest = (requestType: CreateRequestType) => {
    newRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      requestType,
      parentId: targetParentId,
    });
  };

  const createFolder = () => {
    showModal(PromptModal, {
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: (name: string) =>
        newRequestGroupFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          parentId: targetParentId,
          name,
        }),
    });
  };

  const actions = createRequestOrFolderActionItems({ createRequest, createFolder, folderFirst: true });

  return (
    <MenuTrigger>
      <Button
        aria-label={ariaLabel}
        className="flex items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-md) bg-(--hl-xxs) p-1.5 px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
      >
        <Icon icon="plus" /> <span className="hidden md:block">Create</span>
      </Button>
      <Popover className="flex min-w-max flex-col overflow-y-hidden">
        <Menu
          aria-label={`${ariaLabel} actions`}
          selectionMode="single"
          onAction={key => actions.find(action => action.id === key)?.action()}
          items={actions}
          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
        >
          {item => (
            <MenuItem
              key={item.id}
              id={item.id}
              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
              aria-label={item.name}
            >
              <Icon icon={item.icon} className="h-4 w-3" />
              <span>{item.name}</span>
            </MenuItem>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};

export const EmptyNode = ({ item, storageRules, depthOffset = 0 }: EmptyNodeProps) => {
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
  const createNewMockServer = () =>
    setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true, source: 'sidebar' });
  const createNewGlobalEnvironment = () =>
    setNewWorkspaceModalState({ scope: 'environment', isOpen: true, source: 'sidebar' });
  const createNewMcpClient = () => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true, source: 'sidebar' });

  const parentId = requestGroup?._id || workspace?._id || project._id;

  const createInProjectActionList: ActionItem[] = [
    {
      id: 'new-collection',
      name: 'Request collection',
      scope: 'collection',
      icon: 'bars',
      action: createNewCollection,
    },
    {
      id: 'new-document',
      name: 'Design document',
      scope: 'design',
      icon: 'file',
      action: createNewDocument,
    },
    {
      id: 'new-mcp-client',
      name: 'MCP Client',
      scope: 'mcp',
      icon: ['fac', 'mcp'] as unknown as IconProp,
      action: createNewMcpClient,
    },

    {
      id: 'new-mock-server',
      name: 'Mock Server',
      scope: 'mock-server',
      icon: 'server' as IconName,
      action: createNewMockServer,
    },

    {
      id: 'new-environment',
      name: 'Environment',
      scope: 'environment',
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

  const paddingLeft = kind === 'emptyProject' ? '2em' : `${Math.max(level + 3 - depthOffset, 1)}rem`;

  return (
    <div className={ROW_CLASS} style={{ paddingLeft }} data-testid={`empty-node-${kind}`}>
      <Button slot="drag" className="hidden" />
      {kind === 'emptyProject' ? (
        <span className={`${GUIDE_LINE_CSS} left-6 group-hover/tree:bg-(--hl-sm)`} />
      ) : (
        [1.5, 2.5]
          .map(pos => pos - depthOffset)
          .filter(pos => pos > 0)
          .map(pos => (
            <span
              key={pos}
              className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`}
              style={{ left: `${pos}em` }}
            />
          ))
      )}
      {kind === 'emptyFolder' &&
        Array.from({ length: level + 2 }, (_, i) => i)
          .filter(i => i >= depthOffset)
          .map(i => (
            <span
              key={i}
              className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm)`}
              style={{ left: `${i + 1.5 - depthOffset}em` }}
            />
          ))}
      <span className={`${kind === 'emptyFolder' ? 'ml-7' : 'ml-3'} min-w-0 flex-1 truncate text-sm`}>
        {getLabel()}
      </span>
      {kind === 'emptyProject' ? (
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
              onAction={key => createInProjectActionList.find(item => item.id === key)?.action()}
              items={createInProjectActionList}
              className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
            >
              {item => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                >
                  {item.scope ? (
                    <div
                      className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} flex h-4 w-4 items-center justify-center rounded-sm p-1`}
                    >
                      <Icon icon={item.icon} className="h-3 w-3 shrink-0" />
                    </div>
                  ) : (
                    <Icon icon={item.icon} className="h-4 w-3" />
                  )}
                  <span>{item.name}</span>
                </MenuItem>
              )}
            </Menu>
          </Popover>
        </MenuTrigger>
      ) : kind === 'emptyFolder' ? (
        workspace && (
          <CollectionCreateButton
            organizationId={organizationId}
            projectId={project._id}
            workspaceId={workspace._id}
            parentId={parentId}
            ariaLabel={`Create in ${getAriaLabel()}`}
          />
        )
      ) : null}
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
