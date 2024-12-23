import {
  type FontAwesomeIconProps,
} from '@fortawesome/react-fontawesome';
import React, {
  type FC,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  Form,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  type PressEvent,
  Radio,
  RadioGroup,
  TextField,
} from 'react-aria-components';
import {
  useNavigate,
} from 'react-router-dom';

import * as models from '../../../models';
import { type Project, PROJECT_STORAGE_TYPE } from '../../../models/project';
import { invariant } from '../../../utils/invariant';
import { insomniaFetch } from '../../insomniaFetch';
import { ORG_STORAGE_RULE } from '../../routes/organization';
import { Icon } from '../icon';

export enum PROJECT_EDIT_MODAL_TYPE {
  NEW = 'new',
  EDIT = 'edit',
};

// TODO: add restriction to switch to git sync

enum PROJECT_EDIT_MODAL_STATE {
  BASE_INFO,
  CHANGE_STORAGE_TYPE_CONFIRMATION,
  GIT_SYNC_INFO,
  ERROR,
};

interface BaseInfoType {
  name: string;
  storageType: PROJECT_STORAGE_TYPE;
};

interface ErrorInfoType {
  title: string;
  message: string;
}

interface ProjectEditModalBaseProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  orgStorageRule: ORG_STORAGE_RULE;
  organizationId: string;
  isGitSyncEnabled: boolean;
}

interface ProjectEditModalNewProps extends ProjectEditModalBaseProps {
  modalType: PROJECT_EDIT_MODAL_TYPE.NEW;
  projectToEdit: null;
}

interface ProjectEditModalEditProps extends ProjectEditModalBaseProps {
  modalType: PROJECT_EDIT_MODAL_TYPE.EDIT;
  projectToEdit: Project;
}

// TODO: revalidate
// TODO: error
// TODO: add Loading
const ProjectEditModal: FC<ProjectEditModalNewProps | ProjectEditModalEditProps> = ({
  modalType,
  isOpen,
  setIsOpen,
  orgStorageRule,
  organizationId,
  projectToEdit,
  isGitSyncEnabled,
}) => {
  console.log('projectToEdit', projectToEdit);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const showStorageRestrictionMessage = orgStorageRule !== ORG_STORAGE_RULE.CLOUD_PLUS_LOCAL;
  const [modalState, setModalState] = useState<PROJECT_EDIT_MODAL_STATE>(PROJECT_EDIT_MODAL_STATE.BASE_INFO);

  // return to base info state after modal is closed
  useEffect(() => {
    if (!isOpen) {
      setModalState(PROJECT_EDIT_MODAL_STATE.BASE_INFO);
    }
  }, [isOpen]);

  const baseInfoRef = useRef<BaseInfoType | null>(null);
  const [errInfo, setErrInfo] = useState<ErrorInfoType | null>(null);
  const showError = useCallback((errInfo: ErrorInfoType) => {
    setErrInfo(errInfo);
    setModalState(PROJECT_EDIT_MODAL_STATE.ERROR);
  }, []);
  const title = useMemo(() => {
    if (modalState === PROJECT_EDIT_MODAL_STATE.ERROR) {
      return errInfo?.title || 'Error';
    }
    if (modalState === PROJECT_EDIT_MODAL_STATE.GIT_SYNC_INFO) {
      return 'Configure Git Remote Repository';
    }
    if (modalState === PROJECT_EDIT_MODAL_STATE.CHANGE_STORAGE_TYPE_CONFIRMATION) {
      invariant(baseInfoRef.current, 'Base info is required');
      const selectedStorageType = baseInfoRef.current.storageType;
      if (selectedStorageType === PROJECT_STORAGE_TYPE.LOCAL) {
        return 'Confirm conversion to local storage';
      } else if (selectedStorageType === PROJECT_STORAGE_TYPE.CLOUD) {
        return 'Confirm conversion to cloud synchronization';
      } else if (selectedStorageType === PROJECT_STORAGE_TYPE.GIT) {
        return 'Confirm conversion to git synchronization';
      } else {
        throw new Error(`Invalid storage type: ${selectedStorageType}`);
      }
    }
    if (modalType === PROJECT_EDIT_MODAL_TYPE.NEW) {
      return 'Create a New Project';
    } else if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT) {
      return 'Project Settings';
    } else {
      throw new Error(`Invalid modal type: ${modalType}`);
    }
  }, [modalState, modalType, errInfo?.title]);
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
      const oriStorageType = projectToEdit?.storageType || PROJECT_STORAGE_TYPE.CLOUD;
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
    projectToEdit,
  ]);

  const onBaseInfoSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const baseInfo = Object.fromEntries(formData) as unknown as BaseInfoType;
    baseInfoRef.current = baseInfo;
    if (modalType === PROJECT_EDIT_MODAL_TYPE.NEW) {
      if (baseInfo.storageType === PROJECT_STORAGE_TYPE.GIT) {
        setModalState(PROJECT_EDIT_MODAL_STATE.GIT_SYNC_INFO);
      } else {
        createNewProject({
          organizationId,
          name: (typeof baseInfo.name === 'string') ? baseInfo.name : 'My project',
          storageType: baseInfo.storageType,
        }).then(
          newProjectId => {
            navigate(`/organization/${organizationId}/project/${newProjectId}`);
            close();
          },
          err => {
            const errMsg = err.message;
            if (errMsg === 'NEEDS_TO_UPGRADE') {
              setErrInfo({
                title: 'Upgrade your plan',
                message: 'You are currently on the Free plan where you can invite as many collaborators as you want as long as you don\'t have more than one project. Since you have more than one project, you need to upgrade to "Individual" or above to continue.',
              });
            } else if (errMsg === 'FORBIDDEN') {
              setErrInfo({
                title: 'Could not create project',
                message: 'You do not have permission to create a project in this organization.',
              });
            } else {
              setErrInfo({
                title: 'Could not create project',
                message: 'errMsg',
              });
            }
            setModalState(PROJECT_EDIT_MODAL_STATE.ERROR);
          },
        );
      }
    } else if (modalType === PROJECT_EDIT_MODAL_TYPE.EDIT) {
      invariant(projectToEdit, 'Active project is required');
      if (baseInfo.storageType !== projectToEdit.storageType) {
        // storage type is changed, need confirmation
        setModalState(PROJECT_EDIT_MODAL_STATE.CHANGE_STORAGE_TYPE_CONFIRMATION);
      } else {
        // storage type is not changed
        updateProject({
          organizationId,
          projectId: projectToEdit._id,
          name: baseInfo.name,
          storageType: baseInfo.storageType,
        }).then(
          () => {
            close();
          },
          err => {
            const errMsg = err.message;
            showError({
              title: 'Could not update project',
              message: errMsg,
            });
          },
        );
      }
    } else {
      throw new Error(`Invalid modal type: ${modalType}`);
    }
  }, [modalType, organizationId, navigate, close, projectToEdit, showError]);

  const onChangeStorageTypeConfirm = useCallback(() => {
    invariant(baseInfoRef.current, 'Base info is required');
    invariant(projectToEdit, 'Active project is required');
    if (baseInfoRef.current.storageType === PROJECT_STORAGE_TYPE.GIT) {
      setModalState(PROJECT_EDIT_MODAL_STATE.GIT_SYNC_INFO);
    } else {
      updateProject({
        organizationId,
        projectId: projectToEdit._id,
        name: baseInfoRef.current.name,
        storageType: baseInfoRef.current.storageType,
      }).then(
        () => {
          close();
        },
        err => {
          const errMsg = err.message;
          showError({
            title: 'Could not update project',
            message: errMsg,
          });
        },
      );
    }
  }, [projectToEdit, close, organizationId, showError]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => setIsOpen(isOpen)}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
        <Dialog className="outline-none">
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
            {
              modalState === PROJECT_EDIT_MODAL_STATE.ERROR
              && (
                <div className="flex flex-col gap-4">
                  <p>
                    {errInfo?.message}
                  </p>
                  <ButtonLine
                    confirmBtnContent="Ok"
                    onConfirm={close}
                  />
                </div>
              )
            }
            {
              modalState === PROJECT_EDIT_MODAL_STATE.BASE_INFO
              && (
                <Form
                  className='flex flex-col gap-4'
                  onSubmit={onBaseInfoSubmit}
                >
                  <TextField
                    autoFocus
                    name="name"
                    defaultValue={modalType === PROJECT_EDIT_MODAL_TYPE.EDIT ? projectToEdit?.name : 'My project'}
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
                  <RadioGroup name="storageType" defaultValue={defaultStorageTypeSelection} className="flex flex-col gap-2">
                    <Label className="text-sm text-[--hl]">
                      Storage type
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
                  <ButtonLine
                    leftPart={showStorageRestrictionMessage && (
                      <div className="flex items-center gap-2 text-sm">
                        <Icon icon="info-circle" />
                        <span>
                          {`The organization owner mandates that projects must be created and stored ${orgStorageRule.split('_').join(' ')}.`}
                        </span>
                      </div>
                    )}
                    cancelBtnContent="Cancel"
                    onCancel={close}
                    confirmBtnContent={modalType === PROJECT_EDIT_MODAL_TYPE.NEW ? 'Create' : 'Update'}
                    isSubmit
                  />
                </Form>
              )
            }
            {
              modalState === PROJECT_EDIT_MODAL_STATE.CHANGE_STORAGE_TYPE_CONFIRMATION && (
                <div className='flex flex-col gap-4'>
                  {
                    baseInfoRef.current?.storageType === PROJECT_STORAGE_TYPE.LOCAL
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
                    baseInfoRef.current?.storageType === PROJECT_STORAGE_TYPE.CLOUD
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
                    baseInfoRef.current?.storageType === PROJECT_STORAGE_TYPE.GIT
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
                  <ButtonLine
                    cancelBtnContent="Cancel"
                    onCancel={close}
                    confirmBtnContent="Confirm"
                    onConfirm={onChangeStorageTypeConfirm}
                  />
                </div>
              )
            }
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

// TODO: check text content for each storage type confirmation

ProjectEditModal.displayName = 'NewProjectModal';

const storageTypeOptionTextMap = {
  [PROJECT_STORAGE_TYPE.LOCAL]: {
    icon: 'fa-solid fa-laptop' as FontAwesomeIconProps['icon'],
    title: 'Local Vault',
    description: 'Stored locally only with no cloud. Ideal when collaboration is not needed.',
  },
  [PROJECT_STORAGE_TYPE.CLOUD]: {
    icon: 'fa-solid fa-globe' as FontAwesomeIconProps['icon'],
    title: 'Cloud Sync',
    description: 'Encrypted and synced securely to the cloud, ideal for out of the box collaboration.',
  },
  [PROJECT_STORAGE_TYPE.GIT]: {
    icon: 'fa-brands fa-git-alt' as FontAwesomeIconProps['icon'],
    title: 'Git Sync',
    description: 'Stored locally via a 3rd party Git repository.',
  },
};

const ButtonLine: FC<{
  leftPart?: ReactNode;
  cancelBtnContent?: ReactNode;
  onCancel?: (e: PressEvent) => void;
  isSubmit?: boolean;
  confirmBtnContent: ReactNode;
  onConfirm?: (e: PressEvent) => void;
}> = ({
  leftPart,
  cancelBtnContent,
  onCancel,
  isSubmit = false,
  confirmBtnContent,
  onConfirm,
}) => {
    return (
      <div className="flex justify-between gap-2 items-center">
        {
          leftPart
            ? leftPart
            : (<div />)
        }
        <div className='flex items-center gap-2'>
          {
            cancelBtnContent && (
              <Button
                onPress={onCancel}
                className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
              >
                {cancelBtnContent}
              </Button>
            )
          }
          <Button
            className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
            {...(isSubmit
              ? { type: 'submit' }
              : { onPress: onConfirm })}
          >
            {confirmBtnContent}
          </Button>
        </div>
      </div>
    );
  };

async function createNewProject({
  organizationId,
  name,
  storageType,
}: {
  organizationId: string;
  name: string;
    storageType: PROJECT_STORAGE_TYPE;
}) {
  invariant(organizationId, 'Organization ID is required');
  invariant(typeof name === 'string', 'Name is required');
  invariant(Object.values(PROJECT_STORAGE_TYPE).includes(storageType), 'Storage type is required');

  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to create a project');

  if (storageType === PROJECT_STORAGE_TYPE.LOCAL) {
    const project = await models.project.create({
      name,
      parentId: organizationId,
      storageType,
    });
    return project._id;
  } else if (storageType === PROJECT_STORAGE_TYPE.CLOUD) {
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
        storageType,
      });

      return project._id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : `An unexpected error occurred while creating the project. Please try again. ${err}`);
    }
  } else if (storageType === PROJECT_STORAGE_TYPE.GIT) {
    // TODO: git info
  } else {
    throw new Error(`Invalid storage type: ${storageType}`);
  }
}

// TODO: test scratchpad

async function updateProject({
  organizationId,
  projectId,
  name,
  storageType,
}: {
  organizationId: string;
  projectId: string;
  name: string;
  storageType: PROJECT_STORAGE_TYPE;
}) {
  const project = await models.project.getById(projectId);
  invariant(project, 'Project not found');
  const user = await models.userSession.getOrCreate();
  const sessionId = user.id;
  invariant(sessionId, 'User must be logged in to update a project');

  const doesStorageTypeChange = storageType !== project.storageType;

  try {
    // If its a cloud project, and we are renaming, then patch
    if (
      sessionId
      && project.storageType === PROJECT_STORAGE_TYPE.CLOUD
      && !doesStorageTypeChange
      && name !== project.name
    ) {
      const response = await insomniaFetch<void | {
        error: string;
        message?: string;
      }>({
        path: `/v1/organizations/${project.parentId}/team-projects/${project.remoteId}`,
        method: 'PATCH',
        sessionId,
        data: {
          name,
        },
      });

      if (response && 'error' in response) {
        let error = 'An unexpected error occurred while updating your project. Please try again.';
        if (response.error === 'FORBIDDEN') {
          error = response.error;
        }

        if (response.error === 'NEEDS_TO_UPGRADE') {
          error = 'Upgrade your account in order to create new Cloud Projects.';
        }

        if (response.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Local Vault project creation, please try again.';
        }

        throw new Error(error);
      }

      await models.project.update(project, { name });
      return;
    }

    // convert from cloud to local
    if (
      project.storageType === PROJECT_STORAGE_TYPE.CLOUD
      && storageType === PROJECT_STORAGE_TYPE.LOCAL
    ) {
      const response = await insomniaFetch<void | {
        error: string;
        message?: string;
      }>({
        path: `/v1/organizations/${organizationId}/team-projects/${project.remoteId}`,
        method: 'DELETE',
        sessionId,
      });

      if (response && 'error' in response) {
        let error = 'An unexpected error occurred while updating your project. Please try again.';

        if (response.error === 'FORBIDDEN') {
          error = 'You do not have permission to change this project.';
        }

        if (response.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Cloud Sync project creation, please try again.';
        }

        throw new Error(error);
      }

      await models.project.update(project, { name, remoteId: null });
      return;
    }

    // convert from local to cloud
    if (
      project.storageType === PROJECT_STORAGE_TYPE.LOCAL
      && storageType === PROJECT_STORAGE_TYPE.CLOUD
    ) {
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
        let error = 'An unexpected error occurred while updating your project. Please try again.';
        if (newCloudProject.error === 'FORBIDDEN') {
          error = newCloudProject.error;
        }

        if (newCloudProject.error === 'NEEDS_TO_UPGRADE') {
          error = 'Upgrade your account in order to create new Cloud Projects.';
        }

        if (newCloudProject.error === 'PROJECT_STORAGE_RESTRICTION') {
          error = 'The owner of the organization allows only Local Vault project creation, please try again.';
        }

        throw new Error(error);
      }

      await models.project.update(project, { name, remoteId: newCloudProject.id });
      return;
    }

    // local project rename
    if (!doesStorageTypeChange && project.storageType === PROJECT_STORAGE_TYPE.LOCAL) {
      await models.project.update(project, { name });
      return null;
    }

    // TODO: other cases
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : `An unexpected error occurred while renaming the project. Please try again. ${err}`);
  }
};

export default ProjectEditModal;
