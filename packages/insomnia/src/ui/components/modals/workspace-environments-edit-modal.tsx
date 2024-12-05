import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useMemo, useRef, useState } from 'react';
import { Button, Dialog, DropIndicator, GridList, GridListItem, Heading, Label, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover, Text, ToggleButton, useDragAndDrop } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { docsAfterResponseScript, docsTemplateTags } from '../../../common/documentation';
import { debounce } from '../../../common/misc';
import { type Environment, type EnvironmentKvPairData, EnvironmentKvPairDataType, EnvironmentType, getDataFromKVPair } from '../../../models/environment';
import { isRemoteProject } from '../../../models/project';
import { responseTagRegex } from '../../../templating/utils';
import { useOrganizationPermissions } from '../../hooks/use-organization-features';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { EditableInput } from '../editable-input';
import { EnvironmentEditor, type EnvironmentEditorHandle, type EnvironmentInfo } from '../editors/environment-editor';
import { EnvironmentKVEditor } from '../editors/environment-key-value-editor/key-value-editor';
import { handleToggleEnvironmentType } from '../editors/environment-utils';
import { Icon } from '../icon';
import { showAlert } from '.';

export const WorkspaceEnvironmentsEditModal = ({ onClose }: {
  onClose: () => void;
}) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const routeData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);

  const { features } = useOrganizationPermissions();

  const createEnvironmentFetcher = useFetcher();
  const deleteEnvironmentFetcher = useFetcher();
  const updateEnvironmentFetcher = useFetcher();
  const duplicateEnvironmentFetcher = useFetcher();

  const {
    baseEnvironment,
    activeEnvironment,
    subEnvironments,
    activeProject,
    activeWorkspaceMeta,
  } = routeData;
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
  const allowSwitchEnvironment = !selectedEnvironment?.kvPairData?.some(d => d.type === EnvironmentKvPairDataType.SECRET);

  const environmentActionsList: {
    id: string;
    name: string;
    icon: IconName;
    action: (environment: Environment) => void;
  }[] = [{
    id: 'duplicate',
    name: 'Duplicate',
    icon: 'copy',
    action: async (environment: Environment) => {
      duplicateEnvironmentFetcher.submit({
        environmentId: environment._id,
      },
        {
          method: 'post',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/duplicate`,
        });
      },
    }, {
        id: 'delete',
        name: 'Delete',
        icon: 'trash',
        action: async (environment: Environment) => {
          showAlert({
            title: 'Delete Environment',
            message: `Are you sure you want to delete "${environment.name}"?`,
            addCancel: true,
            okLabel: 'Delete',
            onConfirm: async () => {
              deleteEnvironmentFetcher.submit(
                {
                  environmentId: environment._id,
                },
                {
                  method: 'post',
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/delete`,
                }
              );

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
            isPrivate: false,
          },
            {
              method: 'post',
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/create`,
              encType: 'application/json',
            });
        },
      }, {
        id: 'private',
        name: 'Private environment',
      description: 'Local and not exportable',
      icon: 'lock',
        action: async () => {
          createEnvironmentFetcher.submit({
            isPrivate: true,
          },
            {
              method: 'post',
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/create`,
              encType: 'application/json',
            });
        },
      },
    ];

  const debouncedHandleChange = debounce((value: EnvironmentInfo) => {
    if (environmentEditorRef.current?.isValid() && selectedEnvironment) {
      const { object, propertyOrder } = value;

      updateEnvironmentFetcher.submit({
        patch: {
          data: object,
          dataPropertyOrder: propertyOrder,
        },
        environmentId: selectedEnvironment._id,
      }, {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
        encType: 'application/json',
      });
    }
  }, 500);

  const handleKVPairChange = (kvPairData: EnvironmentKvPairData[]) => {
    if (selectedEnvironment) {
      const environmentData = getDataFromKVPair(kvPairData);
      updateEnvironmentFetcher.submit(JSON.stringify({
        patch: {
          data: environmentData.data,
          dataPropertyOrder: environmentData.dataPropertyOrder,
          kvPairData,
        },
        environmentId: selectedEnvironment._id,
      }), {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
        encType: 'application/json',
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
        patch: { metaSortKey: sourceEnv.metaSortKey },
        environmentId: sourceEnv._id,
      }, {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
        encType: 'application/json',
      });
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        if (target.dropPosition === 'before' && target.key === baseEnvironment._id) {
          return <DropIndicator
            target={target}
            className="hidden"
          />;
        }
        return <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline"
        />;
      }

      return <DropIndicator
        target={target}
        className="outline-[--color-surprise] outline-1 outline"
      />;
    },
  });

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-[calc(100%-var(--padding-xl))] h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden h-full'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Manage Environments</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded flex-1 w-full overflow-hidden divide-x divide-solid divide-[--hl-md] basis-96 flex border border-solid border-[--hl-sm] select-none overflow-y-auto'>
                <GridList
                  aria-label="Environments"
                  items={[baseEnvironment, ...subEnvironments]}
                  className="overflow-y-auto max-w-xs w-full flex-shrink-0 data-[empty]:py-0 py-[--padding-xs]"
                  disallowEmptySelection
                  selectionMode="single"
                  selectionBehavior='replace'
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
                        className="group outline-none select-none"
                      >
                        <div className={`${item.parentId === workspaceId ? 'pl-4' : 'pl-8'} pr-4 flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]`}>
                          <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                          <Icon
                            icon={
                              item.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'
                            }
                            className='w-5'
                            style={{
                              color: item.color || undefined,
                            }}
                          />
                          <EditableInput
                            value={item.name}
                            name="name"
                            ariaLabel="Environment name"
                            className="px-1 flex-1 hover:!bg-transparent"
                            onSubmit={name => {
                              name && updateEnvironmentFetcher.submit({
                                patch: {
                                  name,
                                },
                                environmentId: item._id,
                              }, {
                                method: 'post',
                                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
                                encType: 'application/json',
                              });
                            }}
                          />
                          {item.parentId !== workspaceId && <MenuTrigger>
                            <Button
                              aria-label="Environment Actions"
                              className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                            >
                              <Icon icon="caret-down" />
                            </Button>
                            <Popover className="min-w-max overflow-y-hidden flex flex-col">
                              <Menu
                                aria-label="Environment Actions menu"
                                selectionMode="single"
                                onAction={key => {
                                  environmentActionsList
                                    .find(({ id }) => key === id)
                                    ?.action(item);
                                }}
                                items={environmentActionsList}
                                className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                              >
                                {item => (
                                  <MenuItem
                                    key={item.id}
                                    id={item.id}
                                    className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                                    aria-label={item.name}
                                  >
                                    <Icon className='w-5' icon={item.icon} />
                                    <span>{item.name}</span>
                                  </MenuItem>
                                )}
                              </Menu>
                            </Popover>
                          </MenuTrigger>}
                          {item.parentId === workspaceId && (
                            <MenuTrigger>
                              <Button
                                aria-label="Create Environment"
                                data-testid="CreateEnvironmentDropdown"
                                className="items-center flex justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                              >
                                <Icon icon="plus-circle" />
                              </Button>
                              <Popover className="min-w-max overflow-y-hidden flex flex-col">
                                <Menu
                                  aria-label="Create Environment menu"
                                  selectionMode="single"
                                  onAction={key => {
                                    createEnvironmentActionsList
                                      .find(({ id }) => key === id)
                                      ?.action(item);
                                  }}
                                  items={createEnvironmentActionsList}
                                  className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                                >
                                  {item => (
                                    <MenuItem
                                      key={item.id}
                                      id={item.id}
                                      className="flex flex-col gap-1 px-[--padding-md] py-2 aria-selected:font-bold text-[--color-font] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                                      aria-label={item.name}
                                    >
                                      <div className='flex gap-2 items-center'>
                                        <Icon className='w-5' icon={item.icon} />
                                        <span>{item.name}</span>
                                      </div>
                                      <Text slot="description" className='text-xs text-[--hl]'>
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
                <div className='flex-1 flex flex-col divide-solid divide-y divide-[--hl-md] overflow-hidden'>
                  <div className='flex items-center justify-between gap-2 w-full px-[--padding-sm] overflow-hidden'>
                    <Heading className='flex items-center flex-grow gap-2 text-lg py-2 px-4 overflow-hidden'>
                      <Icon style={{ color: selectedEnvironment?.color || '' }} className='w-4' icon={selectedEnvironment?.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'} />
                      <EditableInput
                        value={selectedEnvironment?.name || ''}
                        name="name"
                        ariaLabel="Environment name"
                        className="px-1 flex-1"
                        onSubmit={name => {
                          name && updateEnvironmentFetcher.submit({
                            patch: {
                              name,
                            },
                            environmentId: selectedEnvironmentId,
                          }, {
                            method: 'post',
                            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
                            encType: 'application/json',
                          });
                        }}
                      />
                    </Heading>
                    {selectedEnvironment && selectedEnvironment.parentId !== workspaceId && (
                      <Label className='mr-2 ml-auto flex-shrink-0 flex items-center gap-2 py-1 px-2 bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'>
                        <span>Color:</span>
                        <input
                          onChange={e => {
                            const color = e.target.value;
                            updateEnvironmentFetcher.submit({
                              patch: {
                                color,
                              },
                              environmentId: selectedEnvironment._id,
                            }, {
                              method: 'post',
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
                              encType: 'application/json',
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
                          const toggleSwitchEnvironmentType = (newEnvironmentType: EnvironmentType, kvPairData: EnvironmentKvPairData[]) => {
                            updateEnvironmentFetcher.submit(JSON.stringify({
                              patch: {
                                environmentType: newEnvironmentType,
                                kvPairData: kvPairData,
                              },
                              environmentId: selectedEnvironment._id,
                            }), {
                              method: 'post',
                              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
                              encType: 'application/json',
                            });
                          };
                          const isValidJSON = !!environmentEditorRef.current?.isValid();
                          handleToggleEnvironmentType(isSelected, selectedEnvironment, isValidJSON, toggleSwitchEnvironmentType);
                        }}
                        isSelected={selectedEnvironment?.environmentType !== EnvironmentType.KVPAIR}
                        className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-colors text-sm"
                        aria-label={selectedEnvironment?.environmentType !== EnvironmentType.KVPAIR ? 'Table Edit' : 'Raw Edit'}
                      >
                        {({ isSelected }) => (
                          <Fragment>
                            <Icon icon={!isSelected ? 'toggle-on' : 'toggle-off'} className={`${!isSelected ? 'text-[--color-success]' : ''}`} />
                            <span>Table View</span>
                          </Fragment>
                        )}
                      </ToggleButton>
                    )}
                  </div>
                  {/* legacy JSON environment do not have environmentType property*/}
                  {selectedEnvironment && (selectedEnvironment.environmentType === EnvironmentType.JSON || !selectedEnvironment.environmentType) && (
                    <EnvironmentEditor
                      ref={environmentEditorRef}
                      key={selectedEnvironment._id}
                      onChange={debouncedHandleChange}
                      environmentInfo={{
                        object: selectedEnvironment.data,
                        propertyOrder: selectedEnvironment.dataPropertyOrder,
                      }}
                    />
                  )}
                  {selectedEnvironment && selectedEnvironment.environmentType === EnvironmentType.KVPAIR &&
                    <EnvironmentKVEditor
                      key={selectedEnvironment._id}
                      data={selectedEnvironment.kvPairData || []}
                      onChange={handleKVPairChange}
                    />
                  }
                </div>
              </div>
              <div className='flex items-center gap-2 justify-between'>
                <div className='flex flex-col gap-1'>
                  {/* Warning message when user uses response tag in environment variable and suggest to user after-response script INS-4243 */}
                  {hasResponseTagEnvironmentVariable &&
                    <p className='text-sm italic warning'>
                      <Icon icon="exclamation-circle" /><a href={docsAfterResponseScript}> We suggest to save your response into an environment variable using after-response script.</a>
                    </p>
                  }
                  <p className='text-sm italic'>
                    * Environment data can be used for <a href={docsTemplateTags}>Nunjucks Templating</a> in your requests.
                  </p>
                </div>
                <Button
                  onPress={close}
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
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
