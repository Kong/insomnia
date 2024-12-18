import classNames from 'classnames';
import React, {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  TextField,
} from 'react-aria-components';
import {
  useNavigate,
} from 'react-router-dom';

import { getAppWebsiteBaseURL } from '../../../common/constants';
import * as models from '../../../models';
import { type Project, PROJECT_STORAGE_TYPE } from '../../../models/project';
import { invariant } from '../../../utils/invariant';
import { insomniaFetch } from '../../insomniaFetch';
import { ORG_STORAGE_RULE } from '../../routes/organization';
import { Icon } from '../icon';
import { showAlert, showModal } from '.';
import { AskModal } from './ask-modal';

export enum PROJECT_EDIT_MODAL_TYPE {
  NEW = 'new',
  EDIT = 'edit',
};
type ProjectType = 'local' | 'remote';

// TODO: add restriction to switch to git sync

const ProjectEditModal: FC<{
  modalType: PROJECT_EDIT_MODAL_TYPE;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  orgStorageRule: ORG_STORAGE_RULE;
  organizationId: string;
  activeProject: Project | undefined;
  isGitSyncEnabled: boolean;
}> = ({
  modalType,
  isOpen,
  setIsOpen,
  orgStorageRule,
  organizationId,
  activeProject,
  isGitSyncEnabled,
}) => {
  const showStorageRestrictionMessage = orgStorageRule !== ORG_STORAGE_RULE.CLOUD_PLUS_LOCAL;
  const [doesShowChangeStorageTypeConfirmation, setDoesShowChangeStorageTypeConfirmation] = useState(false);

  // hide ChangeStorageTypeConfirmation screen when modal is closed
  useEffect(() => {
    if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT && !isOpen) {
      setDoesShowChangeStorageTypeConfirmation(false);
    }
  }, [isOpen, modalType]);

  const selectedStorageTypeRef = useRef<PROJECT_STORAGE_TYPE>(PROJECT_STORAGE_TYPE.LOCAL);
  const title = useMemo(() => {
    if (modalType === PROJECT_EDIT_MODAL_TYPE.NEW) {
      return 'Create a New Project';
    } else if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT) {
      if (!doesShowChangeStorageTypeConfirmation) {
        return 'Project Settings';
      } else {
        if (selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.LOCAL) {
          return 'Confirm conversion to local storage';
        } else if (selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.CLOUD) {
          return 'Confirm conversion to cloud synchronization';
        } else if (selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.GIT) {
          return 'Confirm conversion to git synchronization';
        } else {
          throw new Error(`Invalid storage type: ${selectedStorageTypeRef.current}`);
        }
      }
    } else {
      throw new Error(`Invalid modal type: ${modalType}`);
    }
  }, [modalType, doesShowChangeStorageTypeConfirmation]);
  const navigate = useNavigate();
  const storageTypeAvailableMap = useMemo(() => {
    return {
      [PROJECT_STORAGE_TYPE.LOCAL]: orgStorageRule !== ORG_STORAGE_RULE.CLOUD_ONLY,
      [PROJECT_STORAGE_TYPE.CLOUD]: orgStorageRule !== ORG_STORAGE_RULE.LOCAL_ONLY,
      [PROJECT_STORAGE_TYPE.GIT]: isGitSyncEnabled,
    };
  }, [isGitSyncEnabled, orgStorageRule]);
  const defaultStorageTypeSelection = useMemo(() => {
    if (modalType === PROJECT_EDIT_MODAL_TYPE.NEW) {
      if (storageTypeAvailableMap[PROJECT_STORAGE_TYPE.CLOUD]) {
        return PROJECT_STORAGE_TYPE.CLOUD;
      } else {
        return PROJECT_STORAGE_TYPE.LOCAL;
      }
    } else if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT) {
      const oriStorageType = activeProject?.storageType || PROJECT_STORAGE_TYPE.CLOUD;
      if (storageTypeAvailableMap[oriStorageType]) {
        return oriStorageType;
      } else if (storageTypeAvailableMap[PROJECT_STORAGE_TYPE.CLOUD]) {
        return PROJECT_STORAGE_TYPE.CLOUD;
      } else if (storageTypeAvailableMap[PROJECT_STORAGE_TYPE.LOCAL]) {
        return PROJECT_STORAGE_TYPE.LOCAL;
      } else if (storageTypeAvailableMap[PROJECT_STORAGE_TYPE.GIT]) {
        return PROJECT_STORAGE_TYPE.GIT;
      } else {
        throw new Error('No storage type available');
      }
    } else {
      throw new Error(`Invalid modal type: ${modalType}`);
    }
  }, [
    modalType,
    storageTypeAvailableMap,
    activeProject,
  ]);

  const genOnSubmit = (close: () => void) => ((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get('type');
    const name = formData.get('name');

    selectedStorageTypeRef.current = type as PROJECT_STORAGE_TYPE;

    if (modalType === PROJECT_EDIT_MODAL_TYPE.NEW) {
      createNewProject({
        organizationId,
        name: (typeof name === 'string') ? name : 'My project',
        projectType: type as ProjectType,
      }).then(
        newProjectId => {
          navigate(`/organization/${organizationId}/project/${newProjectId}`);
        },
        err => {
          const errMsg = err.message;
          if (errMsg === 'NEEDS_TO_UPGRADE') {
            showModal(AskModal, {
              title: 'Upgrade your plan',
              message: 'You are currently on the Free plan where you can invite as many collaborators as you want as long as you don\'t have more than one project. Since you have more than one project, you need to upgrade to "Individual" or above to continue.',
              yesText: 'Upgrade',
              noText: 'Cancel',
              onDone: async (isYes: boolean) => {
                if (isYes) {
                  window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=individual`);
                }
              },
            });
          } else if (errMsg === 'FORBIDDEN') {
            showAlert({
              title: 'Could not create project.',
              message: 'You do not have permission to create a project in this organization.',
            });
          } else {
            showAlert({
              title: 'Could not create project.',
              message: errMsg,
            });
          }
        },
      );
      close();
    } else if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT) {
      updateProjectFetcher.submit(formData, {
        action: `/organization/${organizationId}/project/${projectId}/update`,
        method: 'post',
      });
      close();
    }
  });

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => setIsOpen(isOpen)}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
        <Dialog className="outline-none">
          {({ close }) => (
            <div className='flex flex-col gap-4'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>{title}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <form
                className='flex flex-col gap-4'
                onSubmit={genOnSubmit(close)}
              >
                <div
                  className={classNames([
                    'flex flex-col gap-4',
                    {
                      'hidden': modalType === PROJECT_EDIT_MODAL_TYPE.EDIT
                        && doesShowChangeStorageTypeConfirmation,
                    },
                  ])}
                >
                  <TextField
                    autoFocus
                    name="name"
                    defaultValue={modalType === PROJECT_EDIT_MODAL_TYPE.EDIT ? activeProject?.name : 'My project'}
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
                  {/* TODO: type val has changed, update action */}
                  <RadioGroup name="type" defaultValue={defaultStorageTypeSelection} className="flex flex-col gap-2">
                    <Label className="text-sm text-[--hl]">
                      Project type
                    </Label>
                    <div className="flex gap-2">
                      {[
                        PROJECT_STORAGE_TYPE.CLOUD,
                        PROJECT_STORAGE_TYPE.LOCAL,
                        PROJECT_STORAGE_TYPE.GIT,
                      ].map(storageType => (
                        <Radio
                          key={storageType}
                          isDisabled={!storageTypeAvailableMap[storageType]}
                          value={storageType}
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon={storageTypeOptionTextMap[storageType].icon} />
                            <Heading className="text-lg font-bold">
                              {storageTypeOptionTextMap[storageType].title}
                            </Heading>
                          </div>
                          <p className='pt-2'>
                            {storageTypeOptionTextMap[storageType].description}
                          </p>
                        </Radio>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
                {
                  modalType === PROJECT_EDIT_MODAL_TYPE.EDIT
                  && doesShowChangeStorageTypeConfirmation
                  && (<>
                    {
                      selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.LOCAL
                      && (
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
                      )
                    }
                    {
                      selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.CLOUD
                      && (
                        <div className='text-[--color-font] flex flex-col gap-4'>
                          <div className='flex flex-col gap-4'>
                            <p>
                              We will be synchronizing your local project to Insomnia's Cloud in a secure encrypted format which will enable cloud collaboration.
                            </p>
                            <ul className='text-left flex flex-col gap-2'>
                              <li><i className="fa fa-check text-emerald-600" /> Your data in the cloud is encrypted and secure.</li>
                              <li><i className="fa fa-check text-emerald-600" /> You can now collaborate with any amount of users and use cloud features.</li>
                              <li><i className="fa fa-check text-emerald-600" /> Your project will be always available on any client after logging in.</li>
                            </ul>
                            <p>
                              You can still use Git Sync for cloud projects.
                            </p>
                          </div>
                        </div>
                      )
                    }
                    {
                      selectedStorageTypeRef.current === PROJECT_STORAGE_TYPE.GIT
                      && (
                        <div className='text-[--color-font] flex flex-col gap-4'>
                          <div className='flex flex-col gap-4'>
                            <p>
                              We will be synchronizing your local project to Insomnia's Cloud in a secure encrypted format which will enable cloud collaboration.
                            </p>
                            <ul className='text-left flex flex-col gap-2'>
                              <li><i className="fa fa-check text-emerald-600" /> Your data in the cloud is encrypted and secure.</li>
                              <li><i className="fa fa-check text-emerald-600" /> You can now collaborate with any amount of users and use cloud features.</li>
                              <li><i className="fa fa-check text-emerald-600" /> Your project will be always available on any client after logging in.</li>
                            </ul>
                            <p>
                              You can still use Git Sync for cloud projects.
                            </p>
                          </div>
                        </div>
                      )
                    }
                  </>)
                }
                <div className="flex justify-between gap-2 items-center">
                  {
                    showStorageRestrictionMessage
                      ? (<div className="flex items-center gap-2 text-sm">
                        <Icon icon="info-circle" />
                        <span>
                          {`The organization owner mandates that projects must be created and stored ${orgStorageRule.split('_').join(' ')}.`}
                        </span>
                      </div>)
                      : (<div />)
                  }
                  <div className='flex items-center gap-2'>
                    <Button
                      onPress={close}
                      className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      {modalType === PROJECT_EDIT_MODAL_TYPE.NEW ? 'Create' : (
                        doesShowChangeStorageTypeConfirmation
                          ? 'Confirm'
                          : 'Update'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
  };

ProjectEditModal.displayName = 'NewProjectModal';

async function createNewProject({
  organizationId,
  name,
  projectType,
}: {
  organizationId: string;
  name: string;
  projectType: ProjectType;
}) {
  invariant(organizationId, 'Organization ID is required');
  invariant(typeof name === 'string', 'Name is required');
  invariant(projectType === 'local' || projectType === 'remote', 'Project type is required');

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to create a project');

  if (projectType === 'local') {
    const project = await models.project.create({
      name,
      parentId: organizationId,
    });
    return project._id;
  }

  try {
    const newCloudProject = await insomniaFetch<{
      id: string;
      name: string;
    } | {
      error: string;
      message?: string;
    }>({
      path: `/v1/organizations/${organizationId}/team-projects`,
      method: 'POST',
      data: {
        name,
      },
      sessionId,
    });

    if (!newCloudProject || 'error' in newCloudProject) {
      let error = 'An unexpected error occurred while creating the project. Please try again.';
      if (newCloudProject.error === 'FORBIDDEN') {
        error = newCloudProject.error;
      }

      if (newCloudProject.error === 'NEEDS_TO_UPGRADE') {
        error = 'Upgrade your account in order to create new Cloud Projects.';
      }

      if (newCloudProject.error === 'PROJECT_STORAGE_RESTRICTION') {
        error = newCloudProject.message ?? 'The owner of the organization allows only Local Vault project creation.';
      }

      throw new Error(error);
    }

    const project = await models.project.create({
      _id: newCloudProject.id,
      name: newCloudProject.name,
      remoteId: newCloudProject.id,
      parentId: organizationId,
    });

    return project._id;
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : `An unexpected error occurred while creating the project. Please try again. ${err}`);
  }
}

const storageTypeOptionTextMap = {
  [PROJECT_STORAGE_TYPE.LOCAL]: {
    icon: 'laptop',
    title: 'Local Vault',
    description: 'Stored locally only with no cloud. Ideal when collaboration is not needed.',
  },
  [PROJECT_STORAGE_TYPE.CLOUD]: {
    icon: 'globe',
    title: 'Cloud Sync',
    description: 'Encrypted and synced securely to the cloud, ideal for out of the box collaboration.',
  },
  [PROJECT_STORAGE_TYPE.GIT]: {
    icon: 'globe',
    title: 'Git Sync',
    description: 'Stored locally via a 3rd party Git repository.',
  },
};

export default ProjectEditModal;
