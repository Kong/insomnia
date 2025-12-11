import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, Fragment, useEffect, useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover, Tooltip, TooltipTrigger } from 'react-aria-components';

import type { StorageRules } from '~/models/organization';
import { useProjectDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.delete';

import type { GitRepository } from '../../../models/git-repository';
import { getProjectStorageTypeLabel, isGitProject, isRemoteProject, type Project } from '../../../models/project';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { ProjectModal } from '../modals/project-modal';

interface Props {
  project: Project & { hasUncommittedOrUnpushedChanges?: boolean; gitRepository?: GitRepository };
  organizationId: string;
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
}

interface ProjectActionItem {
  id: string;
  name: string;
  icon: IconName;
  action: (projectId: string, projectName: string) => void;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId, storageRules, isGitSyncEnabled }) => {
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] = useState(false);
  const deleteProjectFetcher = useProjectDeleteActionFetcher();

  const isRemoteProjectInconsistent = isRemoteProject(project) && !storageRules.enableCloudSync;
  const isLocalProjectInconsistent =
    !isRemoteProject(project) && !isGitProject(project) && !storageRules.enableLocalVault;
  const isGitProjectInconsistent = isGitProject(project) && !storageRules.enableGitSync;
  const isProjectInconsistent = isRemoteProjectInconsistent || isLocalProjectInconsistent || isGitProjectInconsistent;

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

        if (isGitProject(project)) {
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

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showModal(AlertModal, {
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

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
            {`This project type is not allowed by the organization owner. You can manually convert it to use ${getProjectStorageTypeLabel(storageRules)}.`}
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
          <Icon icon="caret-down" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden">
          <Menu
            aria-label="Project Actions Menu"
            selectionMode="single"
            onAction={key => {
              projectActionList.find(({ id }) => key === id)?.action(project._id, project.name);
            }}
            items={projectActionList}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
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
      {isProjectSettingsModalOpen && (
        <ProjectModal
          project={project}
          isGitSyncEnabled={isGitSyncEnabled}
          storageRules={storageRules}
          gitRepository={project.gitRepository}
          isOpen={isProjectSettingsModalOpen}
          onOpenChange={setIsProjectSettingsModalOpen}
        />
      )}
    </Fragment>
  );
};
