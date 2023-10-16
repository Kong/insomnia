import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  Heading,
  Input,
  Item,
  Label,
  Menu,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Radio,
  RadioGroup,
  TextField,
} from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import {
  isDefaultOrganizationProject,
  Project,
} from '../../../models/project';
import { Icon } from '../icon';
import { showAlert } from '../modals';

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
  const updateProjectFetcher = useFetcher();
  const [projectType, setProjectType] = useState<'local' | 'remote' | ''>('');

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
      <ModalOverlay
        isOpen={isProjectSettingsModalOpen}
        onOpenChange={isOpen => {
          setProjectType('');
          setIsProjectSettingsModalOpen(isOpen);
        }}
        isDismissable
        className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
      >
        <Modal className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
          <Dialog
            onClose={() => {
              setIsProjectSettingsModalOpen(false);
              setProjectType('');
            }}
            className="outline-none"
          >
            {({ close }) => (
              <div className='flex flex-col gap-4'>
                <div className='flex gap-2 items-center justify-between'>
                  <Heading className='text-2xl'>{projectType === 'local' ? 'Confirm conversion to local storage' : projectType === 'remote' ? 'Confirm cloud synchronization' : 'Project Settings'}</Heading>
                  <Button
                    className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                {isDefaultOrganizationProject(project) && <p>
                  <Icon icon="info-circle" /> This is the default project for your organization. You can not delete it or change its type.
                </p>}
                <form
                  className='flex flex-col gap-4'
                  onSubmit={e => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const type = formData.get('type');
                    // If the project is local and the user is trying to change it to remote
                    if (type === 'remote' && !project.remoteId && !projectType) {
                      setProjectType('remote');
                      // If the project is remote and the user is trying to change it to local
                    } else if (type === 'local' && project.remoteId && !projectType) {
                      setProjectType('local');
                    } else {
                      updateProjectFetcher.submit(formData, {
                        action: `/organization/${organizationId}/project/${project._id}/update`,
                        method: 'post',
                      });

                      close();
                    }
                  }}
                >
                  <div className={`flex flex-col gap-4 ${projectType ? 'hidden' : ''}`}>
                    <TextField
                      autoFocus
                      name="name"
                      defaultValue={project.name}
                      className="group relative flex-1 flex flex-col gap-2"
                    >
                      <Label className='text-sm text-[--hl]'>
                        Project name
                      </Label>
                      <Input
                        placeholder="My project"
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                    </TextField>
                    <RadioGroup name="type" defaultValue={project.remoteId ? 'remote' : 'local'} className="flex flex-col gap-2">
                      <Label className="text-sm text-[--hl]">
                        Project type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          value="remote"
                          className="data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <Icon icon="globe" />
                          <Heading className="text-lg font-bold">Secure Cloud</Heading>
                          <p className='pt-2'>
                            End-to-end encrypted (E2EE) and synced securely to the cloud, ideal for collaboration.
                          </p>
                        </Radio>
                        <Radio
                          isDisabled={isDefaultOrganizationProject(project)}
                          value="local"
                          className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <Icon icon="laptop" />
                          <Heading className="text-lg font-bold">Local Vault</Heading>
                          <p className="pt-2">
                            Stored locally only with no cloud. Ideal when collaboration is not needed.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                  </div>

                  {projectType === 'local' && (
                    <div className='text-[--color-font] flex flex-col gap-4'>
                      <div className='flex flex-col gap-4'>
                        <p>
                          We will be converting your Cloud Sync project into a local project, and permanently remove all cloud data for this project from the cloud.
                        </p>
                        <ul className='text-left flex flex-col gap-2'>
                          <li><i className="fa fa-check text-emerald-600" /> The project will be 100% stored locally.</li>
                          <li><i className="fa fa-check text-emerald-600" /> Your collaborators will not be able to push and pull files anymore.</li>
                          <li><i className="fa fa-check text-emerald-600" /> The project will become local also for every existing collaborator.</li>
                        </ul>
                        <p>
                          You can still use Git Sync for local projects without using the cloud, and you can synchronize a local project back to the cloud if you decide to do so.
                        </p>
                        <p className='flex gap-2 items-center'>
                          <Icon icon="triangle-exclamation" className='text-[--color-warning]' />
                          Remember to pull your latest project updates before this operation
                        </p>
                      </div>
                    </div>
                  )}
                  {projectType === 'remote' && (
                    <div className='text-[--color-font] flex flex-col gap-4'>
                      <div className='flex flex-col gap-4'>
                        <p>
                          We will be synchronizing your local project to Insomnia's Cloud in a secure end-to-end encrypted format (E2EE) which will enable cloud collaboration.
                        </p>
                        <ul className='text-left flex flex-col gap-2'>
                          <li><i className="fa fa-check text-emerald-600" /> Your data in the cloud is end-to-end encrypted (E2EE) and secure.</li>
                          <li><i className="fa fa-check text-emerald-600" /> You can now collaborate with any amount of users and use cloud features.</li>
                          <li><i className="fa fa-check text-emerald-600" /> Your project will be always available on any client after logging in.</li>
                        </ul>
                        <p>
                          You can still use Git Sync for cloud projects.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 items-center">
                    <Button
                      onPress={() => {
                        if (projectType) {
                          setProjectType('');
                        } else {
                          close();
                        }
                      }}
                      className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      {projectType ? 'Confirm' : 'Update'}
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </Fragment>
  );
};
