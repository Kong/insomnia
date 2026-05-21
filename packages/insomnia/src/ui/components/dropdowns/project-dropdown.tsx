import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { StorageRules } from 'insomnia-api';
import React, { type FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams } from 'react-router';
import * as reactUse from 'react-use';

import type { GitRepository, Project, WorkspaceScope } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useProjectDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.delete';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';

import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { ProjectModal } from '../modals/project-modal';

interface Props {
  project: Project & { hasUncommittedOrUnpushedChanges?: boolean; gitRepository?: GitRepository };
  organizationId: string;
  storageRules: StorageRules;
}

interface ProjectActionItem {
  id: string;
  name: string;
  icon: IconProp;
  action: (projectId: string, projectName: string) => void;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId, storageRules }) => {
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] = useState(false);
  const [newWorkspaceModalState, setNewWorkspaceModalState] = useState<{
    scope: WorkspaceScope;
    isOpen: boolean;
  } | null>({
    scope: 'collection',
    isOpen: false,
  });
  const { workspaceId } = useParams() as { workspaceId?: string };

  const deleteProjectFetcher = useProjectDeleteActionFetcher();

  const isRemoteProjectInconsistent = models.project.isRemoteProject(project) && !storageRules.enableCloudSync;
  const isLocalProjectInconsistent =
    !models.project.isRemoteProject(project) && !models.project.isGitProject(project) && !storageRules.enableLocalVault;
  const isGitProjectInconsistent = models.project.isGitProject(project) && !storageRules.enableGitSync;
  const isProjectInconsistent = isRemoteProjectInconsistent || isLocalProjectInconsistent || isGitProjectInconsistent;

  const createNewCollection = () => setNewWorkspaceModalState({ scope: 'collection', isOpen: true });
  const createNewDocument = () => setNewWorkspaceModalState({ scope: 'design', isOpen: true });
  const canCreateMockServer = project?._id;
  const createNewMockServer = () =>
    canCreateMockServer && setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true });
  const createNewGlobalEnvironment = () => setNewWorkspaceModalState({ scope: 'environment', isOpen: true });
  const createNewMcpClient = () => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true });

  const projectActionList: ProjectActionItem[] = [
    {
      id: 'settings',
      name: 'Settings',
      icon: 'gear',
      action: () => setIsProjectSettingsModalOpen(true),
    },
    {
      id: 'delete',
      name: 'Delete',
      icon: 'trash',
      action: (projectId: string, projectName: string) => {
        let message = `You are deleting the project "${projectName}" that may have collaborators. As a result of this, the project will be permanently deleted for every collaborator of the organization. Do you really want to continue?`;

        if (models.project.isGitProject(project)) {
          message = `You are deleting the Git project "${projectName}". Deleting this project will not delete the remote repository but all your local changes will be lost. Do you really want to continue?`;
        }

        showModal(AskModal, {
          title: 'Delete Project',
          message,
          yesText: 'Delete',
          noText: 'Cancel',
          color: 'danger',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              deleteProjectFetcher.submit({
                organizationId,
                projectId,
              });
            }
          },
        });
      },
    },
  ];

  const createInProjectActionList: ProjectActionItem[] = [
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
    ...(canCreateMockServer
      ? [
          {
            id: 'new-mock-server',
            name: 'Mock Server',
            icon: 'server' as IconName,
            action: createNewMockServer,
          },
        ]
      : []),
    {
      id: 'new-environment',
      name: 'Environment',
      icon: 'code',
      action: createNewGlobalEnvironment,
    },
  ];

  const projectDropdownActions: {
    name: string;
    id: string;
    icon: IconProp;
    items: ProjectActionItem[];
  }[] = [
    {
      name: 'CREATE',
      id: 'create in project',
      icon: 'plus',
      items: createInProjectActionList,
    },
    {
      name: 'ACTIONS',
      id: 'project actions',
      icon: 'gear',
      items: projectActionList,
    },
  ];

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showModal(AlertModal, {
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

  reactUse.useUpdateEffect(() => {
    if (workspaceId && newWorkspaceModalState?.isOpen) {
      // Close the new workspace modal if a workspace is already active.
      // Use this because createNewWorkspace action will navigate to the newly create workspace page
      setNewWorkspaceModalState(prev => prev && { ...prev, isOpen: false });
    }
  }, [workspaceId]);

  return (
    <Fragment>
      {isProjectInconsistent && (
        <TooltipTrigger>
          <Button
            onPress={() => setIsProjectSettingsModalOpen(true)}
            className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-80 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
          >
            <Icon icon="triangle-exclamation" color="var(--color-warning)" />
          </Button>
          <Tooltip
            placement="top"
            offset={4}
            className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
          >
            {`This project type is not allowed by the organization owner. You can manually convert it to use ${models.project.getProjectStorageTypeLabel(storageRules)}.`}
          </Tooltip>
        </TooltipTrigger>
      )}
      {project.hasUncommittedOrUnpushedChanges && (
        <div className="flex aspect-square h-6 items-center justify-center group-hover:hidden group-focus:hidden">
          <Icon icon="circle" className="h-2 w-2" color="var(--color-warning)" />
        </div>
      )}
      <MenuTrigger>
        <Button
          aria-label="Project Actions"
          className="hidden aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:flex group-hover:opacity-100 group-focus:flex group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:flex data-pressed:opacity-100"
        >
          <Icon icon="ellipsis" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden">
          <Menu
            aria-label="Project Actions Menu"
            selectionMode="single"
            onAction={key => {
              projectDropdownActions
                .find(i => i.items.find(a => a.id === key))
                ?.items.find(a => a.id === key)
                ?.action(project._id, project.name);
            }}
            items={projectDropdownActions}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
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
                </Collection>
              </MenuSection>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isProjectSettingsModalOpen && (
        <ProjectModal
          project={project}
          storageRules={storageRules}
          gitRepository={project.gitRepository}
          isOpen={isProjectSettingsModalOpen}
          onOpenChange={setIsProjectSettingsModalOpen}
        />
      )}
      {newWorkspaceModalState?.isOpen && (
        <NewWorkspaceModal
          isOpen
          project={project}
          storageRules={storageRules}
          scope={newWorkspaceModalState.scope}
          onOpenChange={isOpen => {
            setNewWorkspaceModalState({
              scope: newWorkspaceModalState.scope,
              isOpen,
            });
          }}
        />
      )}
    </Fragment>
  );
};
