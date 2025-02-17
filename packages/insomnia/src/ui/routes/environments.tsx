import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Breadcrumb, Breadcrumbs, Button, DropIndicator, GridList, GridListItem, Heading, Label, Menu, MenuItem, MenuTrigger, Popover, Text, ToggleButton, useDragAndDrop } from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavLink, useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { DEFAULT_SIDEBAR_SIZE } from '../../common/constants';
import { debounce } from '../../common/misc';
import { type Environment, type EnvironmentKvPairData, EnvironmentType, getDataFromKVPair } from '../../models/environment';
import { isRemoteProject } from '../../models/project';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { EnvironmentEditor, type EnvironmentEditorHandle, type EnvironmentInfo } from '../components/editors/environment-editor';
import { EnvironmentKVEditor } from '../components/editors/environment-key-value-editor/key-value-editor';
import { handleToggleEnvironmentType } from '../components/editors/environment-utils';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showAlert } from '../components/modals';
import { OrganizationTabList } from '../components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '../constant';
import { useInsomniaTab } from '../hooks/use-insomnia-tab';
import { useOrganizationPermissions } from '../hooks/use-organization-features';
import type { WorkspaceLoaderData } from './workspace';

const Environments = () => {
  const { organizationId = '', projectId = '', workspaceId = '' } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
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
    activeProject,
    baseEnvironment,
    activeEnvironment,
    subEnvironments,
    activeWorkspaceMeta,
    activeWorkspace,
  } = routeData;
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(activeEnvironment._id);
  const isUsingInsomniaCloudSync = Boolean(isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId);
  const isUsingGitSync = Boolean(features.gitSync.enabled && (activeWorkspaceMeta?.gitRepositoryId));

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

  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    if (layout && layout[0] > 0) {
      layout[0] = 0;
    } else {
      layout[0] = DEFAULT_SIDEBAR_SIZE;
    }

    sidebarPanelRef.current?.setLayout(layout);
  }

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);

    return unsubscribe;
  }, []);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
  });

  useInsomniaTab({
    organizationId,
    projectId,
    workspaceId,
    activeWorkspace,
    activeProject,
  });

  return (
    <PanelGroup ref={sidebarPanelRef} autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel id="sidebar" className='sidebar theme--sidebar flex flex-col justify-between overflow-hidden divide-solid divide-y divide-[--hl-md]' maxSize={40} minSize={10} collapsible>
        <Breadcrumbs className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] px-[--padding-sm] list-none items-center m-0 gap-2 font-bold w-full`}>
          <Breadcrumb className="flex select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
            <NavLink
              data-testid="project"
              className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              to={`/organization/${organizationId}/project/${activeProject._id}`}
            >
              <Icon className='text-xs' icon="chevron-left" />
            </NavLink>
            <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
          </Breadcrumb>
          <Breadcrumb className="flex truncate select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
            <WorkspaceDropdown />
          </Breadcrumb>
        </Breadcrumbs>
        <GridList
          aria-label="Environments"
          items={[baseEnvironment, ...subEnvironments]}
          className="overflow-y-auto flex-1 w-full flex-shrink-0 data-[empty]:py-0 py-[--padding-xs]"
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
                      aria-label="Project Actions"
                      className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover className="min-w-max overflow-y-hidden flex flex-col">
                      <Menu
                        aria-label="Environment Actions"
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
                          aria-label="New Environment"
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
        <WorkspaceSyncDropdown />
      </Panel>
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel id="pane-one" className='pane-one theme--pane flex flex-col'>
        <OrganizationTabList />
        <div className='flex-1 flex flex-col divide-solid divide-y divide-[--hl-md] overflow-hidden'>
          <div className='flex flex-shrink-0 basis-[--line-height-sm] items-center p-[--padding-sm] justify-between gap-2 w-full overflow-hidden'>
            <Heading className='flex flex-grow items-center gap-2 text-lg py-2 px-4 overflow-hidden'>
              <Icon className='w-4' icon={selectedEnvironment?.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'} />
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
              <Label className='mr-2 flex-shrink-0 flex ml-auto items-center gap-2 py-1 px-2 bg-[--hl-sm] data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'>
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
            {selectedEnvironment && (
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
          {selectedEnvironment && (selectedEnvironment.environmentType === EnvironmentType.JSON || !selectedEnvironment.environmentType) &&
            <EnvironmentEditor
              ref={environmentEditorRef}
              key={selectedEnvironment._id}
              onChange={debouncedHandleChange}
              environmentInfo={{
                object: selectedEnvironment.data,
                propertyOrder: selectedEnvironment.dataPropertyOrder,
              }}
            />
          }
          {selectedEnvironment && selectedEnvironment.environmentType === EnvironmentType.KVPAIR &&
            <EnvironmentKVEditor
              key={selectedEnvironment._id}
              data={selectedEnvironment.kvPairData || []}
              onChange={handleKVPairChange}
            />
          }
        </div>
      </Panel>
    </PanelGroup>
  );
};

export default Environments;
