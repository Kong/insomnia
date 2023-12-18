import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { useRef, useState } from 'react';
import { Button, Dialog, DropIndicator, GridList, GridListItem, Heading, Label, ListBoxItem, Menu, MenuTrigger, Modal, ModalOverlay, Popover, useDragAndDrop } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { docsTemplateTags } from '../../../common/documentation';
import { debounce } from '../../../common/misc';
import type { Environment } from '../../../models/environment';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { EditableInput } from '../editable-input';
import { EnvironmentEditor, EnvironmentEditorHandle, EnvironmentInfo } from '../editors/environment-editor';
import { Icon } from '../icon';
import { showAlert } from '.';

// const ROOT_ENVIRONMENT_NAME = 'Base Environment';

export const WorkspaceEnvironmentsEditModal = ({ onClose }: {
  onClose: () => void;
}) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const routeData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);

  const createEnvironmentFetcher = useFetcher();
  const deleteEnvironmentFetcher = useFetcher();
  const updateEnvironmentFetcher = useFetcher();
  const duplicateEnvironmentFetcher = useFetcher();

  const {
    baseEnvironment,
    activeEnvironment,
    subEnvironments,
  } = routeData;
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(activeEnvironment._id);

  const selectedEnvironment = [baseEnvironment, ...subEnvironments].find(env => env._id === selectedEnvironmentId);

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
              deleteEnvironmentFetcher.submit({
                environmentId: environment._id,
              },
                {
                  method: 'post',
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/delete`,
                });
            },
          });
        },
      },
    ];

  const createEnvironmentActionsList: {
    id: string;
    name: string;
    icon: IconName;
    action: (environment: Environment) => void;
  }[] = [{
    id: 'shared',
    name: 'Shared environment',
    icon: 'refresh',
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
        sourceEnv.metaSortKey = targetEnv.metaSortKey - 1;
      }
      if (dropPosition === 'after') {
        sourceEnv.metaSortKey = targetEnv.metaSortKey + 1;
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
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Manage Environments</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded w-full overflow-hidden divide-x divide-solid divide-[--hl-md] basis-96 flex border border-solid border-[--hl-sm] select-none overflow-y-auto max-h-96'>
                <GridList
                  aria-label="Environments"
                  items={[baseEnvironment, ...subEnvironments]}
                  className="overflow-y-auto max-w-xs flex-shrink-0 data-[empty]:py-0 py-[--padding-xs]"
                  disallowEmptySelection
                  selectionMode="single"
                  selectionBehavior='replace'
                  selectedKeys={[selectedEnvironmentId]}
                  dragAndDropHooks={environmentsDragAndDrop.dragAndDropHooks}
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      setSelectedEnvironmentId(keys.values().next().value);
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
                              item.parentId === workspaceId ? 'refresh' : item.isPrivate ? 'lock' : 'refresh'
                            }
                            style={{
                              color: item.color || undefined,
                            }}
                          />
                          {item.parentId === workspaceId ? <span className='truncate flex-1'>{item.name}</span> : (
                            <EditableInput
                              value={item.name}
                              name="name"
                              ariaLabel="Environment name"
                              className="px-1 flex-1"
                              onSingleClick={() => {
                                setSelectedEnvironmentId(item._id);
                              }}
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
                          )}
                          {item.parentId !== workspaceId && <MenuTrigger>
                            <Button
                              aria-label="Project Actions"
                              className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                            >
                              <Icon icon="caret-down" />
                            </Button>
                            <Popover className="min-w-max">
                              <Menu
                                aria-label="Environment Actions"
                                selectionMode="single"
                                onAction={key => {
                                  environmentActionsList
                                    .find(({ id }) => key === id)
                                    ?.action(item);
                                }}
                                items={environmentActionsList}
                                className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                              >
                                {item => (
                                  <ListBoxItem
                                    key={item.id}
                                    id={item.id}
                                    className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                                    aria-label={item.name}
                                  >
                                    <Icon icon={item.icon} />
                                    <span>{item.name}</span>
                                  </ListBoxItem>
                                )}
                              </Menu>
                            </Popover>
                          </MenuTrigger>}
                          {item.parentId === workspaceId && (
                            <MenuTrigger>
                              <Button
                                aria-label="Create Environment"
                                className="items-center flex justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                              >
                                <Icon icon="plus-circle" />
                              </Button>
                              <Popover className="min-w-max">
                                <Menu
                                  aria-label="New Environment"
                                  selectionMode="single"
                                  onAction={key => {
                                    createEnvironmentActionsList
                                      .find(({ id }) => key === id)
                                      ?.action(item);
                                  }}
                                  items={createEnvironmentActionsList}
                                  className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                >
                                  {item => (
                                    <ListBoxItem
                                      key={item.id}
                                      id={item.id}
                                      className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                                      aria-label={item.name}
                                    >
                                      <Icon icon={item.icon} />
                                      <span>{item.name}</span>
                                    </ListBoxItem>
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
                  <div className='flex items-center justify-between gap-2 w-full overflow-hidden'>
                    <Heading className='flex items-center gap-2 text-lg py-2 px-4 overflow-hidden'>
                      <Icon className='w-4' icon={selectedEnvironment?.isPrivate ? 'lock' : 'refresh'} />
                      <EditableInput
                        value={selectedEnvironment?.name || ''}
                        name="name"
                        ariaLabel="Environment name"
                        className="px-1 flex-1"
                        onSingleClick={() => {
                          setSelectedEnvironmentId(selectedEnvironmentId);
                        }}
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
                      <Label className='mr-2 flex-shrink-0 flex items-center gap-2 py-1 px-2 bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'>
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
                  </div>
                  {selectedEnvironment && (
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
                </div>
              </div>
              <div>
                <p className='text-sm italic'>
                  * Environment data can be used for <a href={docsTemplateTags}>Nunjucks Templating</a> in your requests.
                </p>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
