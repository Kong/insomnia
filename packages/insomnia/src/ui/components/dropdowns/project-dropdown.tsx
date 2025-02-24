import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import type { GitRepository } from '../../../models/git-repository';
import {
  isRemoteProject,
  type Project,
} from '../../../models/project';
import { ORG_STORAGE_RULE } from '../../routes/organization';
import { Icon } from '../icon';
import { showAlert, showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { ProjectModal } from '../modals/project-modal';

interface Props {
  project: Project & { hasUncommittedOrUnpushedChanges?: boolean; gitRepository?: GitRepository };
  organizationId: string;
  storage: ORG_STORAGE_RULE;
  isGitSyncEnabled: boolean;
}

interface ProjectActionItem {
  id: string;
  name: string;
  icon: IconName;
  action: (projectId: string, projectName: string) => void;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId, storage, isGitSyncEnabled }) => {
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] =
    useState(false);
  const deleteProjectFetcher = useFetcher();
  const updateProjectFetcher = useFetcher();

  const isRemoteProjectInconsistent = isRemoteProject(project) && storage === ORG_STORAGE_RULE.LOCAL_ONLY;
  const isLocalProjectInconsistent = !isRemoteProject(project) && storage === ORG_STORAGE_RULE.CLOUD_ONLY;
  const isProjectInconsistent = isRemoteProjectInconsistent || isLocalProjectInconsistent;

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
        showModal(AskModal, {
          title: 'Delete Project',
          message: `You are deleting the project "${projectName}" that may have collaborators. As a result of this, the project will be permanently deleted for every collaborator of the organization. Do you really want to continue?`,
          yesText: 'Delete',
          noText: 'Cancel',
          color: 'danger',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              deleteProjectFetcher.submit(
                {},
                {
                  method: 'post',
                  action: `/organization/${organizationId}/project/${projectId}/delete`,
                }
              );
            }
          },
        });
      },
    },
  ];

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showAlert({
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

  useEffect(() => {
    if (updateProjectFetcher.data && updateProjectFetcher.data.error && updateProjectFetcher.state === 'idle') {
      showAlert({
        title: 'Could not update project',
        message: updateProjectFetcher.data.error,
      });
    }
  }, [updateProjectFetcher.data, updateProjectFetcher.state]);

  return (
    <Fragment>
      {isProjectInconsistent &&
        <TooltipTrigger>
          <Button
            onPress={() => setIsProjectSettingsModalOpen(true)}
            className="opacity-80 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          >
            <Icon
              icon='triangle-exclamation'
              color="var(--color-warning)"
            />
          </Button>
          <Tooltip
            placement="top"
            offset={4}
            className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            {`This project type is not allowed by the organization owner. You can manually convert it to use ${storage === ORG_STORAGE_RULE.CLOUD_ONLY ? 'Cloud Sync' : 'Local Vault'}.`}
          </Tooltip>
        </TooltipTrigger>
      }
      {project.hasUncommittedOrUnpushedChanges && (
        <div className='group-focus:hidden group-hover:hidden aspect-square h-6 flex items-center justify-center'>
          <Icon icon="circle" className='w-2 h-2' color="var(--color-warning)" />
        </div>
      )}
      <MenuTrigger>
        <Button
          aria-label="Project Actions"
          className="opacity-0 hidden items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 data-[pressed]:flex group-focus:flex group-hover:flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        >
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max overflow-y-hidden flex flex-col">
          <Menu
            aria-label="Project Actions Menu"
            selectionMode="single"
            onAction={key => {
              projectActionList.find(({ id }) => key === id)?.action(project._id, project.name);
            }}
            items={projectActionList}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
          >
            {item => (
              <MenuItem
                key={item.id}
                id={item.id}
                className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
          storageRule={storage}
          gitRepository={project.gitRepository}
          isOpen={isProjectSettingsModalOpen}
          onOpenChange={setIsProjectSettingsModalOpen}
        />
      )}
    </Fragment>
  );
};
