import type { StorageRules } from 'insomnia-api';
import type { Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import type { RefObject } from 'react';
import { useState } from 'react';
import { Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';

import { scopeToBgColorMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import type { CreateRequestType } from '~/ui/hooks/use-request';

import { Icon } from '../icon';
import { showModal } from '../modals';
import { NewWorkspaceModal } from '../modals/new-workspace-modal';
import { PromptModal } from '../modals/prompt-modal';
import type { FlatItem } from '../sidebar/project-navigation-sidebar/types';
import {
  type ActionItem,
  createRequestOrFolderActionItems,
  createWorkspaceActionItems,
} from './actions/create-actions';

interface Props {
  target: FlatItem;
  storageRules: StorageRules;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  onWorkspaceCreated: (workspaceId: string, workspace: Workspace) => void;
}

export const SidebarShortcutActionsDropdown = ({
  target,
  storageRules,
  isOpen,
  onOpenChange,
  triggerRef,
  onWorkspaceCreated,
}: Props) => {
  const [newWorkspaceModalState, setNewWorkspaceModalState] = useState<{
    scope: 'collection' | 'design' | 'mock-server' | 'environment' | 'mcp';
    isOpen: boolean;
  } | null>(null);

  const newRequestFetcher = useRequestNewActionFetcher();
  const newRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const isProject = target.kind === 'project';
  const isCollection = target.kind === 'workspace' && target.doc.scope === 'collection';
  const isNoneCollectionWorkspace = target.kind === 'workspace' && target.doc.scope !== 'collection';
  const isRequest = target.kind === 'collectionChild' && !models.requestGroup.isRequestGroup(target.doc);
  const isRequestGroup = target.kind === 'collectionChild' && models.requestGroup.isRequestGroup(target.doc);
  const allowCreateWorkspace = isProject || isNoneCollectionWorkspace;
  const allowCreateRequest = isCollection || isRequest || isRequestGroup;

  if (!allowCreateWorkspace && !allowCreateRequest) {
    return null;
  }

  const createRequest = (requestType: CreateRequestType) => {
    if (allowCreateRequest) {
      newRequestFetcher.submit({
        organizationId: target.organizationId,
        projectId: target.project._id,
        workspaceId: target.kind === 'workspace' ? target.doc._id : target.workspace._id,
        requestType,
        // If the target is a collection or request group, we want to create the request inside it. Otherwise, we want to create the request at the same level.
        parentId: isCollection || isRequestGroup ? target.doc._id : target.doc.parentId,
      });
      onOpenChange(false);
    }
  };

  const createFolder = () => {
    if (allowCreateRequest) {
      showModal(PromptModal, {
        title: 'New Folder',
        defaultValue: 'My Folder',
        submitName: 'Create',
        label: 'Name',
        selectText: true,
        onComplete: name =>
          newRequestGroupFetcher.submit({
            organizationId: target.organizationId,
            projectId: target.project._id,
            workspaceId: target.kind === 'workspace' ? target.doc._id : target.workspace._id,
            // If the target is a collection or request group, we want to create the request inside it. Otherwise, we want to create the request at the same level.
            parentId: isCollection || isRequestGroup ? target.doc._id : target.doc.parentId,
            name,
          }),
      });
      onOpenChange(false);
    }
  };

  const actions: ActionItem[] = allowCreateWorkspace
    ? createWorkspaceActionItems({
        createCollection: () => {
          setNewWorkspaceModalState({ scope: 'collection', isOpen: true });
          onOpenChange(false);
        },
        createMcpClient: () => {
          setNewWorkspaceModalState({ scope: 'mcp', isOpen: true });
          onOpenChange(false);
        },
        createMockServer: () => {
          setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true });
          onOpenChange(false);
        },
        createEnvironment: () => {
          setNewWorkspaceModalState({ scope: 'environment', isOpen: true });
          onOpenChange(false);
        },
        canCreateMockServer: Boolean(target.kind === 'workspace' ? target.project?._id : target.doc?._id),
      })
    : allowCreateRequest
      ? createRequestOrFolderActionItems({
          createRequest,
          createFolder,
        })
      : [];

  return (
    <>
      <MenuTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
        <Popover
          className="flex min-w-max flex-col overflow-y-hidden"
          offset={4}
          placement="right top"
          triggerRef={triggerRef}
        >
          <Menu
            aria-label="Sidebar Shortcut Create Menu"
            selectionMode="single"
            onAction={key => actions.find(item => item.id === key)?.action()}
            items={actions}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
            defaultSelectedKeys={[allowCreateWorkspace ? 'new-collection' : 'HTTP']}
          >
            <MenuSection className="flex flex-1 flex-col">
              <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                <Icon icon="plus" /> <span>Create</span>
              </Header>
              <Collection items={actions}>
                {item => (
                  <MenuItem
                    id={item.id}
                    className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                    aria-label={item.name}
                  >
                    {allowCreateWorkspace && item?.scope ? (
                      <div
                        className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} flex h-4 w-4 items-center justify-center rounded-sm p-1`}
                      >
                        <Icon icon={item.icon} className="h-3 w-3 shrink-0" />
                      </div>
                    ) : (
                      <Icon icon={item.icon} />
                    )}
                    <span>{item.name}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
      {newWorkspaceModalState?.isOpen && allowCreateWorkspace && (
        <NewWorkspaceModal
          isOpen
          project={target.kind === 'project' ? target.doc : target.project}
          storageRules={storageRules}
          scope={newWorkspaceModalState.scope}
          redirectAfterCreate={false}
          onCreateWorkspace={onWorkspaceCreated}
          onOpenChange={nextIsOpen => {
            setNewWorkspaceModalState(prev =>
              prev
                ? {
                    ...prev,
                    isOpen: nextIsOpen,
                  }
                : null,
            );
          }}
        />
      )}
    </>
  );
};
