import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  Label,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  ToggleButton,
  useDragAndDrop,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { useEnvironmentCreateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.create';
import { useEnvironmentDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.delete';
import { useEnvironmentDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.duplicate';
import { useEnvironmentUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.update';
import { invariant } from '~/utils/invariant';

import { docsAfterResponseScript, docsTemplateTags } from '../../../common/documentation';
import {
  type Environment,
  type EnvironmentKvPairData,
  EnvironmentKvPairDataType,
  EnvironmentType,
  getDataFromKVPair,
} from '../../../models/environment';
import { isRemoteProject } from '../../../models/project';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { responseTagRegex } from '../../../templating/utils';
import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import { EditableInput } from '../editable-input';
import { EnvironmentEditor, type EnvironmentEditorHandle, type EnvironmentInfo } from '../editors/environment-editor';
import { EnvironmentKVEditor } from '../editors/environment-key-value-editor/key-value-editor';
import { handleToggleEnvironmentType } from '../editors/environment-utils';
import { Icon } from '../icon';
import { showModal } from '.';
import { AlertModal } from './alert-modal';

export const WorkspaceEnvironmentsEditModal = ({ onClose }: { onClose: () => void }) => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();

  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const routeData = useWorkspaceLoaderData()!;
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);

  const { features } = useOrganizationPermissions();

  const createEnvironmentFetcher = useEnvironmentCreateActionFetcher();
  const deleteEnvironmentFetcher = useEnvironmentDeleteActionFetcher();
  const updateEnvironmentFetcher = useEnvironmentUpdateActionFetcher();
  const duplicateEnvironmentFetcher = useEnvironmentDuplicateActionFetcher();

  const { baseEnvironment, activeEnvironment, subEnvironments, activeProject, activeWorkspaceMeta } = routeData;
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(activeEnvironment._id);
  const isUsingInsomniaCloudSync = Boolean(isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId);
  const isUsingGitSync = Boolean(features.gitSync.enabled && activeWorkspaceMeta?.gitRepositoryId);

  const selectedEnvironment = [baseEnvironment, ...subEnvironments].find(env => env._id === selectedEnvironmentId);
  const hasResponseTagEnvironmentVariable = useMemo(() => {
    if (selectedEnvironment) {
      return responseTagRegex.test(JSON.stringify(selectedEnvironment.data));
    }
    return false;
  }, [selectedEnvironment]);
  // Do not allowed to switch to json environment if contains secret item
  const allowSwitchEnvironment = !selectedEnvironment?.kvPairData?.some(
    d => d.type === EnvironmentKvPairDataType.SECRET,
  );

  const environmentActionsList: {
    id: string;
    name: string;
    icon: IconName;
    action: (environment: Environment) => void;
  }[] = [
    {
      id: 'duplicate',
      name: 'Duplicate',
      icon: 'copy',
      action: async (environment: Environment) => {
        duplicateEnvironmentFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          environmentId: environment._id,
        });
      },
    },
    {
      id: 'delete',
      name: 'Delete',
      icon: 'trash',
      action: async (environment: Environment) => {
        showModal(AlertModal, {
          title: 'Delete Environment',
          message: `Are you sure you want to delete "${environment.name}"?`,
          addCancel: true,
          okLabel: 'Delete',
          onConfirm: async () => {
            deleteEnvironmentFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              environmentId: environment._id,
            });

            setSelectedEnvironmentId(baseEnvironment._id);
          },
        });
      },
    },
  ];

  const createEnvironmentActionsList: {
    id: string;
    name: string;
    description: string;
    icon: IconProp;
    action: (environment: Environment) => void;
  }[] = [
    {
      id: 'shared',
      name: 'Shared environment',
      description: `${isUsingGitSync ? 'Synced with Git Sync and exportable' : isUsingInsomniaCloudSync ? 'Synced with Insomnia Sync and exportable' : 'Exportable'}`,
      icon: isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down',
      action: async () => {
        createEnvironmentFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          params: {
            isPrivate: false,
          },
        });
      },
    },
    {
      id: 'private',
      name: 'Private environment',
      description: 'Local and not exportable',
      icon: 'lock',
      action: async () => {
        createEnvironmentFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          params: {
            isPrivate: true,
          },
        });
      },
    },
  ];

  const handleEnvironmentChange = (value: EnvironmentInfo) => {
    if (environmentEditorRef.current?.isValid() && selectedEnvironment) {
      const { object, propertyOrder } = value;

      updateEnvironmentFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        patch: {
          data: object,
          dataPropertyOrder: propertyOrder,
        },
        environmentId: selectedEnvironment._id,
      });
    }
  };

  const handleKVPairChange = (kvPairData: EnvironmentKvPairData[]) => {
    if (selectedEnvironment) {
      const environmentData = getDataFromKVPair(kvPairData);
      updateEnvironmentFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        patch: {
          data: environmentData.data,
          dataPropertyOrder: environmentData.dataPropertyOrder,
          kvPairData,
        },
        environmentId: selectedEnvironment._id,
      });
    }
  };
  const environmentsDragAndDrop = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const source = [...e.keys][0];
      const sourceEnv = subEnvironments.find(evt => evt._id === source);
      const targetEnv = subEnvironments.find(evt => evt._id === e.target.key);
      if (!sourceEnv || !targetEnv) {
        return;
      }
      const dropPosition = e.target.dropPosition;
      if (dropPosition === 'before') {
        const currentEnvIndex = subEnvironments.findIndex(evt => evt._id === targetEnv._id);
        const previousEnv = subEnvironments[currentEnvIndex - 1];
        if (!previousEnv) {
          sourceEnv.metaSortKey = targetEnv.metaSortKey - 1;
        } else {
          sourceEnv.metaSortKey = (previousEnv.metaSortKey + targetEnv.metaSortKey) / 2;
        }
      }
      if (dropPosition === 'after') {
        const currentEnvIndex = subEnvironments.findIndex(evt => evt._id === targetEnv._id);
        const nextEnv = subEnvironments[currentEnvIndex + 1];
        if (!nextEnv) {
          sourceEnv.metaSortKey = targetEnv.metaSortKey + 1;
        } else {
          sourceEnv.metaSortKey = (nextEnv.metaSortKey + targetEnv.metaSortKey) / 2;
        }
      }

      updateEnvironmentFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        patch: { metaSortKey: sourceEnv.metaSortKey },
        environmentId: sourceEnv._id,
      });
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        if (target.dropPosition === 'before' && target.key === baseEnvironment._id) {
          return <DropIndicator target={target} className="hidden" />;
        }
        return <DropIndicator target={target} className="outline outline-1 outline-[--color-surprise]" />;
      }

      return <DropIndicator target={target} className="outline outline-1 outline-[--color-surprise]" />;
    },
  });

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Manage Environments
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 select-none divide-x divide-solid divide-[--hl-md] overflow-hidden overflow-y-auto rounded border border-solid border-[--hl-sm]">
                <GridList
                  aria-label="Environments"
                  items={[baseEnvironment, ...subEnvironments]}
                  className="w-full max-w-xs flex-shrink-0 overflow-y-auto py-[--padding-xs] data-[empty]:py-0"
                  disallowEmptySelection
                  selectionMode="single"
                  selectionBehavior="replace"
                  selectedKeys={[selectedEnvironmentId]}
                  dragAndDropHooks={environmentsDragAndDrop.dragAndDropHooks}
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      const [environmentId] = keys.values();
                      setSelectedEnvironmentId(environmentId.toString());
                    }
                  }}
                >
                  {item => {
                    return (
                      <GridListItem
                        key={item._id}
                        id={item._id}
                        textValue={item.name}
                        className="group select-none outline-none"
                      >
                        <div
                          className={`${item.parentId === workspaceId ? 'pl-4' : 'pl-8'} relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden pr-4 text-[--hl] outline-none transition-colors group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] group-aria-selected:text-[--color-font]`}
                        >
                          <span className="absolute left-0 top-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-[--color-surprise]" />
                          <Icon
                            icon={
                              item.isPrivate
                                ? 'lock'
                                : isUsingGitSync
                                  ? ['fab', 'git-alt']
                                  : isUsingInsomniaCloudSync
                                    ? 'globe-americas'
                                    : 'file-arrow-down'
                            }
                            className="w-5"
                            style={{
                              color: item.color || undefined,
                            }}
                          />
                          <EditableInput
                            value={item.name}
                            name="name"
                            ariaLabel="Environment name"
                            className="flex-1 px-1 hover:!bg-transparent"
                            onSubmit={name => {
                              name &&
                                updateEnvironmentFetcher.submit({
                                  organizationId,
                                  projectId,
                                  workspaceId,
                                  patch: {
                                    name,
                                  },
                                  environmentId: item._id,
                                });
                            }}
                          />
                          {item.parentId !== workspaceId && (
                            <MenuTrigger>
                              <Button
                                aria-label="Environment Actions"
                                className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-hover:opacity-100 group-focus:opacity-100 data-[pressed]:bg-[--hl-sm] data-[pressed]:opacity-100"
                              >
                                <Icon icon="caret-down" />
                              </Button>
                              <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                <Menu
                                  aria-label="Environment Actions menu"
                                  selectionMode="single"
                                  onAction={key => {
                                    environmentActionsList.find(({ id }) => key === id)?.action(item);
                                  }}
                                  items={environmentActionsList}
                                  className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
                                >
                                  {item => (
                                    <MenuItem
                                      key={item.id}
                                      id={item.id}
                                      className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                                      aria-label={item.name}
                                    >
                                      <Icon className="w-5" icon={item.icon} />
                                      <span>{item.name}</span>
                                    </MenuItem>
                                  )}
                                </Menu>
                              </Popover>
                            </MenuTrigger>
                          )}
                          {item.parentId === workspaceId && (
                            <MenuTrigger>
                              <Button
                                aria-label="Create Environment"
                                data-testid="CreateEnvironmentDropdown"
                                className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] data-[pressed]:bg-[--hl-sm]"
                              >
                                <Icon icon="plus-circle" />
                              </Button>
                              <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                <Menu
                                  aria-label="Create Environment menu"
                                  selectionMode="single"
                                  onAction={key => {
                                    createEnvironmentActionsList.find(({ id }) => key === id)?.action(item);
                                  }}
                                  items={createEnvironmentActionsList}
                                  className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
                                >
                                  {item => (
                                    <MenuItem
                                      key={item.id}
                                      id={item.id}
                                      className="text-md flex w-full flex-col gap-1 whitespace-nowrap bg-transparent px-[--padding-md] py-2 text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                                      aria-label={item.name}
                                    >
                                      <div className="flex items-center gap-2">
                                        <Icon className="w-5" icon={item.icon} />
                                        <span>{item.name}</span>
                                      </div>
                                      <Text slot="description" className="text-xs text-[--hl]">
                                        {item.description}
                                      </Text>
                                    </MenuItem>
                                  )}
                                </Menu>
                              </Popover>
                            </MenuTrigger>
                          )}
                        </div>
                      </GridListItem>
                    );
                  }}
                </GridList>
                <div className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
                  <div className="flex w-full items-center justify-between gap-2 overflow-hidden px-[--padding-sm]">
                    <Heading className="flex flex-grow items-center gap-2 overflow-hidden px-4 py-2 text-lg">
                      <Icon
                        style={{ color: selectedEnvironment?.color || '' }}
                        className="w-4"
                        icon={
                          selectedEnvironment?.isPrivate
                            ? 'lock'
                            : isUsingGitSync
                              ? ['fab', 'git-alt']
                              : isUsingInsomniaCloudSync
                                ? 'globe-americas'
                                : 'file-arrow-down'
                        }
                      />
                      <EditableInput
                        value={selectedEnvironment?.name || ''}
                        name="name"
                        ariaLabel="Environment name"
                        className="flex-1 px-1"
                        onSubmit={name => {
                          name &&
                            updateEnvironmentFetcher.submit({
                              organizationId,
                              projectId,
                              workspaceId,
                              patch: {
                                name,
                              },
                              environmentId: selectedEnvironmentId,
                            });
                        }}
                      />
                    </Heading>
                    {selectedEnvironment && selectedEnvironment.parentId !== workspaceId && (
                      <Label className="ml-auto mr-2 flex flex-shrink-0 items-center gap-2 rounded-sm bg-[--hl-sm] px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] data-[pressed]:bg-[--hl-sm]">
                        <span>Color:</span>
                        <input
                          onChange={e => {
                            const color = e.target.value;
                            updateEnvironmentFetcher.submit({
                              organizationId,
                              projectId,
                              workspaceId,
                              patch: {
                                color,
                              },
                              environmentId: selectedEnvironment._id,
                            });
                          }}
                          type="color"
                          value={selectedEnvironment?.color || ''}
                        />
                      </Label>
                    )}
                    {selectedEnvironment && allowSwitchEnvironment && (
                      <ToggleButton
                        onChange={isSelected => {
                          const toggleSwitchEnvironmentType = (
                            newEnvironmentType: EnvironmentType,
                            kvPairData: EnvironmentKvPairData[],
                          ) => {
                            updateEnvironmentFetcher.submit({
                              organizationId,
                              projectId,
                              workspaceId,
                              patch: {
                                environmentType: newEnvironmentType,
                                kvPairData: kvPairData,
                              },
                              environmentId: selectedEnvironment._id,
                            });
                          };
                          const isValidJSON = !!environmentEditorRef.current?.isValid();
                          handleToggleEnvironmentType(
                            isSelected,
                            selectedEnvironment,
                            isValidJSON,
                            toggleSwitchEnvironmentType,
                          );
                        }}
                        isSelected={selectedEnvironment?.environmentType !== EnvironmentType.KVPAIR}
                        className="flex w-[14ch] flex-shrink-0 items-center justify-start gap-2 rounded-sm px-2 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-colors hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
                        aria-label={
                          selectedEnvironment?.environmentType !== EnvironmentType.KVPAIR ? 'Table Edit' : 'Raw Edit'
                        }
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <Icon
                              icon={!isSelected ? 'toggle-on' : 'toggle-off'}
                              className={`${!isSelected ? 'text-[--color-success]' : ''}`}
                            />
                            <span>Table View</span>
                          </Fragment>
                        )}
                      </ToggleButton>
                    )}
                  </div>
                  {/* legacy JSON environment do not have environmentType property*/}
                  {selectedEnvironment &&
                    (selectedEnvironment.environmentType === EnvironmentType.JSON ||
                      !selectedEnvironment.environmentType) && (
                      <EnvironmentEditor
                        ref={environmentEditorRef}
                        key={selectedEnvironment._id}
                        onChange={handleEnvironmentChange}
                        environmentInfo={{
                          object: selectedEnvironment.data,
                          propertyOrder: selectedEnvironment.dataPropertyOrder,
                        }}
                      />
                    )}
                  {selectedEnvironment && selectedEnvironment.environmentType === EnvironmentType.KVPAIR && (
                    <EnvironmentKVEditor
                      key={selectedEnvironment._id}
                      data={selectedEnvironment.kvPairData || []}
                      onChange={handleKVPairChange}
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  {/* Warning message when user uses response tag in environment variable and suggest to user after-response script INS-4243 */}
                  {hasResponseTagEnvironmentVariable && (
                    <p className="warning text-sm italic">
                      <Icon icon="exclamation-circle" />
                      <a href={docsAfterResponseScript}>
                        {' '}
                        We suggest to save your response into an environment variable using after-response script.
                      </a>
                    </p>
                  )}
                  <p className="text-sm italic">
                    * Environment data can be used for <a href={docsTemplateTags}>Nunjucks Templating</a> in your
                    requests.
                  </p>
                </div>
                <Button
                  onPress={close}
                  className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
