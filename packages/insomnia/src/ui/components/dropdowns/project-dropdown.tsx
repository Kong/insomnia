import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  Item,
  Menu,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import {
  isDefaultOrganizationProject,
  Project,
} from '../../../models/project';
import { Icon } from '../icon';
import { showAlert } from '../modals';
import ProjectSettingsModal from '../modals/project-settings-modal';

interface Props {
  project: Project;
  organizationId: string;
}

interface ProjectActionItem {
  id: string;
  name: string;
  icon: IconName;
  action: (projectId: string) => void;
}

export const ProjectDropdown: FC<Props> = ({ project, organizationId }) => {
  const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] =
    useState(false);
  const deleteProjectFetcher = useFetcher();

  const projectActionList: ProjectActionItem[] = [
    {
      id: 'settings',
      name: 'Settings',
      icon: 'gear',
      action: () => setIsProjectSettingsModalOpen(true),
    },
    ...!isDefaultOrganizationProject(project) ? [{
      id: 'delete',
      name: 'Delete',
      icon: 'trash',
      action: projectId =>
        deleteProjectFetcher.submit(
          {},
          {
            method: 'post',
            action: `/organization/${organizationId}/project/${projectId}/delete`,
          }
        ),
    }] satisfies ProjectActionItem[] : [],
  ];

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showAlert({
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

  return (
    <Fragment>
      <MenuTrigger>
        <Button
          aria-label="Project Actions"
          className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        >
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max">
          <Menu
            aria-label="Project Actions Menu"
            selectionMode="single"
            onAction={key => {
              projectActionList.find(({ id }) => key === id)?.action(project._id);
            }}
            items={projectActionList}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            {item => (
              <Item
                key={item.id}
                id={item.id}
                className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                aria-label={item.name}
              >
                <Icon icon={item.icon} />
                <span>{item.name}</span>
              </Item>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isProjectSettingsModalOpen && (
        <ProjectSettingsModal
          onHide={() => setIsProjectSettingsModalOpen(false)}
          project={project}
        />
      )}
    </Fragment>
  );
};
