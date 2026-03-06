import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  DropIndicator,
  GridList,
  GridListItem,
  Heading,
  Label,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  ToggleButton,
  useDragAndDrop,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavLink } from 'react-router';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { debounce } from '~/common/misc';
import { userSession } from '~/models';
import {
  type Environment,
  type EnvironmentKvPairData,
  EnvironmentKvPairDataType,
  EnvironmentType,
  getDataFromKVPair,
} from '~/models/environment';
import { isRemoteProject } from '~/models/project';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useEnvironmentCreateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.create';
import { useEnvironmentDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.delete';
import { useEnvironmentDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.duplicate';
import { useEnvironmentUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment.update';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '~/ui/components/editable-input';
import {
  EnvironmentEditor,
  type EnvironmentEditorHandle,
  type EnvironmentInfo,
} from '~/ui/components/editors/environment-editor';
import { EnvironmentKVEditor } from '~/ui/components/editors/environment-key-value-editor/key-value-editor';
import { handleToggleEnvironmentType } from '~/ui/components/editors/environment-utils';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { InputVaultKeyModal } from '~/ui/components/modals/input-vault-key-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { decryptVaultKeyFromSession } from '~/utils/vault';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.environment';

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const user = await userSession.get();

  const vaultKey = user.vaultKey ? await decryptVaultKeyFromSession(user.vaultKey, false) : '';

  return {
    vaultKey,
  };
}

const Component = ({ loaderData, params }: Route.ComponentProps) => {
  const { organizationId, projectId, workspaceId } = params;
  const { vaultKey } = loaderData;
  const routeData = useWorkspaceLoaderData()!;

  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const { features } = useOrganizationPermissions();

  const createEnvironmentFetcher = useEnvironmentCreateActionFetcher();
  const deleteEnvironmentFetcher = useEnvironmentDeleteActionFetcher();
  const updateEnvironmentFetcher = useEnvironmentUpdateActionFetcher();
  const duplicateEnvironmentFetcher = useEnvironmentDuplicateActionFetcher();

  const { activeProject, baseEnvironment, activeEnvironment, subEnvironments, activeWorkspaceMeta } = routeData;
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>(activeEnvironment._id);
  const isUsingInsomniaCloudSync = Boolean(isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId);
  const isUsingGitSync = Boolean(features.gitSync.enabled && activeWorkspaceMeta?.gitRepositoryId);

  const allEnvironment = useMemo(() => {
    return [baseEnvironment, ...subEnvironments];
  }, [baseEnvironment, subEnvironments]);

  // Keep selectedEnvironmentId in sync when navigating between different environment workspaces/tabs.
  useEffect(() => {
    if (!allEnvironment.find(env => env._id === selectedEnvironmentId)) {
      setSelectedEnvironmentId(activeEnvironment._id);
    }
  }, [selectedEnvironmentId, activeEnvironment._id, allEnvironment]);
  const selectedEnvironment = allEnvironment.find(env => env._id === selectedEnvironmentId);
  // Do not allowed to switch to json environment if contains secret item
  const allowSwitchEnvironment = !selectedEnvironment?.kvPairData?.some(
    d => d.type === EnvironmentKvPairDataType.SECRET,
  );
  // Check if there's any environment contains secret item
  const containsSecret = allEnvironment.some(
    env => env.isPrivate && env.kvPairData?.some(pairData => pairData.type === EnvironmentKvPairDataType.SECRET),
  );
  const shouldShowVaultKeyModal = containsSecret && !loaderData.vaultKey;
  const [showInputVaultKeyModal, setShowModal] = useState(shouldShowVaultKeyModal);

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

  const debouncedHandleChange = debounce((value: EnvironmentInfo) => {
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
  }, 500);

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
        sourceEnv.metaSortKey = !previousEnv
          ? targetEnv.metaSortKey - 1
          : (previousEnv.metaSortKey + targetEnv.metaSortKey) / 2;
      }
      if (dropPosition === 'after') {
        const currentEnvIndex = subEnvironments.findIndex(evt => evt._id === targetEnv._id);
        const nextEnv = subEnvironments[currentEnvIndex + 1];
        sourceEnv.metaSortKey = !nextEnv
          ? targetEnv.metaSortKey + 1
          : (nextEnv.metaSortKey + targetEnv.metaSortKey) / 2;
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
        return <DropIndicator target={target} className="outline-1 outline-(--color-surprise) outline-solid" />;
      }

      return <DropIndicator target={target} className="outline-1 outline-(--color-surprise) outline-solid" />;
    },
  });

  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    layout[0] = layout && layout[0] > 0 ? 0 : DEFAULT_SIDEBAR_SIZE;

    sidebarPanelRef.current?.setLayout(layout);
  }

  const handleInputVaultKeyModalClose = () => {
    setShowModal(false);
  };

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);

    return unsubscribe;
  }, []);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
  });

  return (
    <PanelGroup
      ref={sidebarPanelRef}
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel
        id="sidebar"
        className="sidebar theme--sidebar flex flex-col justify-between divide-y divide-solid divide-(--hl-md) overflow-hidden"
        maxSize={40}
        minSize={10}
        collapsible
      >
        <div className="flex flex-col items-start">
          <Breadcrumbs
            className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] m-0 w-full list-none items-center gap-2 px-(--padding-sm) font-bold`}
          >
            <Breadcrumb className="flex h-full items-center gap-2 text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
              <NavLink
                data-testid="project"
                className="flex aspect-square h-7 shrink-0 items-center justify-center gap-2 rounded-xs px-1 py-1 text-sm text-(--color-font) ring-1 ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-focused:outline-hidden"
                to={`/organization/${organizationId}/project/${activeProject._id}`}
              >
                <Icon className="text-xs" icon="chevron-left" />
              </NavLink>
              <span aria-hidden role="separator" className="h-4 text-(--hl-lg) outline-1 outline-solid" />
            </Breadcrumb>
            <Breadcrumb className="flex h-full items-center gap-2 truncate text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
              <WorkspaceDropdown />
            </Breadcrumb>
          </Breadcrumbs>
        </div>
        <GridList
          aria-label="Environments"
          items={[baseEnvironment, ...subEnvironments]}
          className="w-full flex-1 shrink-0 overflow-y-auto py-(--padding-xs) data-empty:py-0"
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
                className="group outline-hidden select-none"
              >
                <div
                  className={`${item.parentId === workspaceId ? 'pl-4' : 'pl-8'} relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden pr-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)`}
                >
                  <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
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
                    className="flex-1 px-1 hover:bg-transparent!"
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
                        aria-label="Project Actions"
                        className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                      >
                        <Icon icon="caret-down" />
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <Menu
                          aria-label="Environment Actions"
                          selectionMode="single"
                          onAction={key => {
                            environmentActionsList.find(({ id }) => key === id)?.action(item);
                          }}
                          items={environmentActionsList}
                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                        >
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
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
                        className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm)"
                      >
                        <Icon icon="plus-circle" />
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <Menu
                          aria-label="New Environment"
                          selectionMode="single"
                          onAction={key => {
                            createEnvironmentActionsList.find(({ id }) => key === id)?.action(item);
                          }}
                          items={createEnvironmentActionsList}
                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                        >
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              className="flex w-full flex-col gap-1 bg-transparent px-(--padding-md) py-2 whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.name}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="w-5" icon={item.icon} />
                                <span>{item.name}</span>
                              </div>
                              <Text slot="description" className="text-xs text-(--hl)">
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
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
      <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
        <OrganizationTabList />
        <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
          <div className="flex w-full shrink-0 basis-(--line-height-sm) items-center justify-between gap-2 overflow-hidden p-(--padding-sm)">
            <Heading className="flex grow items-center gap-2 overflow-hidden px-4 py-2 text-lg">
              <Icon
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
              <Label className="mr-2 ml-auto flex shrink-0 items-center gap-2 rounded-xs bg-(--hl-sm) px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm)">
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
                className="flex w-[14ch] shrink-0 items-center justify-start gap-2 rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                aria-label={selectedEnvironment?.environmentType !== EnvironmentType.KVPAIR ? 'Table Edit' : 'Raw Edit'}
              >
                {({ isSelected }) => (
                  <Fragment>
                    <Icon
                      icon={!isSelected ? 'toggle-on' : 'toggle-off'}
                      className={`${!isSelected ? 'text-(--color-success)' : ''}`}
                    />
                    <span>Table View</span>
                  </Fragment>
                )}
              </ToggleButton>
            )}
          </div>
          {/* legacy JSON environment do not have environmentType property*/}
          {selectedEnvironment &&
            (selectedEnvironment.environmentType === EnvironmentType.JSON || !selectedEnvironment.environmentType) && (
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
          {selectedEnvironment && selectedEnvironment.environmentType === EnvironmentType.KVPAIR && (
            <EnvironmentKVEditor
              key={selectedEnvironment._id}
              data={selectedEnvironment.kvPairData || []}
              isPrivate={selectedEnvironment.isPrivate}
              onChange={handleKVPairChange}
              vaultKey={vaultKey}
            />
          )}
          {showInputVaultKeyModal && <InputVaultKeyModal onClose={handleInputVaultKeyModalClose} allowClose={false} />}
        </div>
      </Panel>
    </PanelGroup>
  );
};

export default Component;
