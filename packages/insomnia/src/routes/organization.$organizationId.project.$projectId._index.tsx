import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import type { WorkspaceScope } from 'insomnia-data';
import { fuzzyMatchAll } from 'insomnia-data/common';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  GridList,
  GridListItem,
  Input,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams } from 'react-router';
import * as reactUse from 'react-use';

import { DASHBOARD_SORT_ORDERS, type DashboardSortOrder, dashboardSortOrderName } from '~/common/constants';
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { getAllLocalFiles } from '~/common/project';
import { sortMethodMap } from '~/common/sorting';
import { invariant } from '~/common/utils/invariant';
import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { WorkspaceCardDropdown } from '~/ui/components/dropdowns/workspace-card-dropdown';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { FirstRequestCreation } from '~/ui/components/first-request-creation';
import { Icon } from '~/ui/components/icon';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { NoSelectedProjectView } from '~/ui/components/panes/no-selected-project-view';
import { ProjectEmptyView } from '~/ui/components/project/project-empty-view';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { TimeFromNow } from '~/ui/components/time-from-now';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';
import { useGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useOrganizationData } from '~/ui/hooks/use-organization-data';
import { useOrganizationStorageRule } from '~/ui/hooks/use-organization-storage-rule';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';
import { isPrimaryClickModifier } from '~/ui/utils';

import type { Route } from './+types/organization.$organizationId.project.$projectId._index';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');
  invariant(organizationId, 'Organization ID is required');

  const localFiles = await getAllLocalFiles({ projectId });

  return {
    localFiles,
  };
}

const Component = ({ loaderData }: Route.ComponentProps) => {
  const { localFiles } = loaderData;
  const { activeProject, activeProjectGitRepository } = useProjectLoaderData()!;
  const { settings } = useRootLoaderData()!;
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const { projects } = useOrganizationData(organizationId);

  const allFiles = localFiles;

  const { issuesByWorkspaceId } = useGitFileIssues();
  const storageRules = useOrganizationStorageRule(organizationId);
  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();

  const projectFileIssues = Object.values(issuesByWorkspaceId);
  const hasProjectFileIssues = projectFileIssues.length > 0;
  const projectFileIssuesMessage =
    'There are issues with one or more Restless files in this project. Use the git CLI and your local file system to resolve them and continue.';

  const [workspaceListFilter, setWorkspaceListFilter] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-filter`,
    '',
  );
  const [workspaceListSortOrder, setWorkspaceListSortOrder] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-sort-order`,
    'modified-desc',
  );
  const [importModalType, setImportModalType] = useState<'file' | 'clipboard' | 'uri' | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isUpdateProjectModalOpen, setIsUpdateProjectModalOpen] = useState(false);
  const collectionItems = useMemo(
    () =>
      localFiles
        .filter(file => file.scope === 'collection' && file.workspace)
        .map(file => ({
          id: file.workspace!._id,
          label: file.name,
        })),
    [localFiles],
  );
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newWorkspaceModalState, setNewWorkspaceModalState] = useState<{
    scope: WorkspaceScope;
    isOpen: boolean;
    redirect?: boolean;
    source?: string;
  } | null>({
    scope: 'collection',
    isOpen: false,
  });

  useEffect(() => {
    setSelectedCollectionId(currentSelection => {
      if (currentSelection && collectionItems.some(collection => collection.id === currentSelection)) {
        return currentSelection;
      }

      return collectionItems[0]?.id ?? null;
    });
  }, [collectionItems]);

  const tabNavigate = useTabNavigate();

  const filteredFiles = allFiles
    .filter(workspace => {
      if (!workspaceListFilter) return true;
      const filterStr = workspaceListFilter.toLowerCase();
      const props = [
        workspace.name?.toLowerCase() || '',
        workspace.branch?.toLowerCase() || '',
        workspace.oasFormat?.toLowerCase() || '',
      ];
      const result = fuzzyMatchAll(filterStr, props, { splitSpace: true, loose: true });
      return Boolean(result?.indexes);
    })
    .sort((a, b) => sortMethodMap[workspaceListSortOrder as DashboardSortOrder](a, b));

  const filesWithPresence = filteredFiles
    .map(file => ({
      ...file,
      fileIssue: file.workspace ? issuesByWorkspaceId[file.workspace._id] : undefined,
      loading: false,
      action: (withTab?: boolean) => {
        if (!activeProject || !file.workspace) {
          showResourceNotFoundToast('Workspace not found');
          return;
        }

        tabNavigate(
          {
            organization: organizationId,
            project: activeProject,
            workspace: file.workspace,
            item: file.workspace,
          },
          {
            withTab,
            shouldNavigate: true,
          },
        );

        return;
      },
    }));

  const canCreateMockServer = activeProject?._id;

  const createNewCollection = useCallback(
    (source: string) => setNewWorkspaceModalState({ scope: 'collection', isOpen: true, source }),
    [setNewWorkspaceModalState],
  );
  const createNewDocument = useCallback(
    // Create collection instead of design document for now.
    (source: string) => setNewWorkspaceModalState({ scope: 'collection', isOpen: true, source }),
    [setNewWorkspaceModalState],
  );
  const createNewMockServer = useCallback(
    (source: string) =>
      canCreateMockServer && setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true, source }),
    [canCreateMockServer, setNewWorkspaceModalState],
  );
  const createNewGlobalEnvironment = useCallback(
    (source: string) => setNewWorkspaceModalState({ scope: 'environment', isOpen: true, source }),
    [setNewWorkspaceModalState],
  );
  const createNewMcpClient = useCallback(
    (source: string) => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true, source }),
    [setNewWorkspaceModalState],
  );

  const createNewCollectionWithRequest = useCallback(() => {
    if (!activeProject) {
      return;
    }

    createNewWorkspaceFetcher.submit({
      organizationId,
      projectId,
      name: 'My first collection',
      scope: 'collection',
      withRequest: true,
      source: 'home-page',
    });
  }, [activeProject, createNewWorkspaceFetcher, organizationId, projectId]);

  const createInProjectActionList = useMemo<
    {
      id: string;
      name: string;
      icon: IconProp;
      scope: WorkspaceScope;
      action: () => void;
    }[]
  >(
    () => [
      {
        id: 'new-collection',
        name: 'API Collection',
        icon: 'bars',
        action: () => createNewCollection('navbar'),
        scope: 'collection',
      },
      ...(settings.aiFeatures
        ? [
            {
              id: 'new-mcp-client',
              name: 'MCP Client',
              scope: 'mcp' as WorkspaceScope,
              icon: ['fac', 'mcp'] as unknown as IconProp,
              action: () => createNewMcpClient('navbar'),
            },
          ]
        : []),
      ...(canCreateMockServer
        ? [
            {
              id: 'new-mock-server',
              name: 'Mock Server',
              scope: 'mock-server' as WorkspaceScope,
              icon: 'server' as IconName,
              action: () => createNewMockServer('navbar'),
            },
          ]
        : []),
      {
        id: 'new-environment',
        name: 'Environment',
        icon: 'code',
        action: () => createNewGlobalEnvironment('navbar'),
        scope: 'environment',
      },
    ],
    [settings.aiFeatures, canCreateMockServer, createNewCollection, createNewGlobalEnvironment, createNewMcpClient, createNewMockServer],
  );


  return (
    <ErrorBoundary>
      <Fragment>
        <OrganizationTabList showActiveStatus={false} />
        <div className="px-4 pt-4">
          {(
            <FirstRequestCreation
              collectionItems={collectionItems}
              selectedCollectionId={selectedCollectionId}
              onSelectedCollectionChange={setSelectedCollectionId}
              onCreateCollection={() => {
                setNewWorkspaceModalState({
                  scope: 'collection',
                  isOpen: true,
                  redirect: false,
                  source: 'first-request-pane',
                });
              }}
              onImportFrom={() => setImportModalType('file')}
            />
          )}
        </div>
        {activeProject ? (
          <div className="flex w-full flex-col overflow-hidden">
            {hasProjectFileIssues ? (
              <div className="p-(--padding-md) pb-0">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-sm bg-[#3A2F08] px-4 py-4 text-(--color-font-warning)`}
                >
                  <p className="text-base">
                    <Icon icon="exclamation-triangle" className="mr-2" />
                    {projectFileIssuesMessage}
                  </p>
                </div>
              </div>
            ) : null}
            {/* Show filter UI if there are files with presence or if the user has entered any filter input(even no match) */}
            {(filesWithPresence.length > 0 || workspaceListFilter) && (
              <div className="flex w-full max-w-xl justify-between gap-2 p-(--padding-md)">
                <SearchField
                  aria-label="Files filter"
                  className="group relative flex-1"
                  value={workspaceListFilter}
                  onChange={filter => {
                    setWorkspaceListFilter(filter);
                  }}
                >
                  <Input
                    placeholder="Filter"
                    className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  />
                  <div className="absolute top-0 right-0 flex h-full items-center px-2">
                    <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
                      <Icon icon="close" />
                    </Button>
                  </div>
                </SearchField>
                <Select
                  aria-label="Sort order"
                  className="aspect-square h-full"
                  selectedKey={workspaceListSortOrder}
                  onSelectionChange={order => setWorkspaceListSortOrder(order as DashboardSortOrder)}
                >
                  <Button
                    aria-label="Select sort order"
                    className="flex aspect-square h-full shrink-0 items-center justify-center rounded-xs bg-(--hl-xxs) text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  >
                    <Icon icon="sort" />
                  </Button>
                  <Popover className="flex min-w-max flex-col overflow-y-hidden">
                    <ListBox
                      items={DASHBOARD_SORT_ORDERS.map(order => {
                        return {
                          id: order,
                          name: dashboardSortOrderName[order],
                        };
                      })}
                      className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                    >
                      {item => (
                        <ListBoxItem
                          id={item.id}
                          key={item.id}
                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label={item.name}
                          textValue={item.name}
                          value={item}
                        >
                          {({ isSelected }) => (
                            <Fragment>
                              <span>{item.name}</span>
                              {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                            </Fragment>
                          )}
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Popover>
                </Select>

                <MenuTrigger>
                  <Button
                    aria-label="Create in project"
                    className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  >
                    <Icon icon="plus-circle" /> <span className="hidden md:block">Create</span>
                  </Button>
                  <Popover className="flex min-w-max flex-col overflow-y-hidden">
                    <Menu
                      aria-label="Create in project actions"
                      selectionMode="single"
                      onAction={key => {
                        const item = createInProjectActionList.find(item => item.id === key);
                        if (item) {
                          item.action();
                        }
                      }}
                      items={createInProjectActionList}
                      className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                    >
                      {item => (
                        <MenuItem
                          key={item.id}
                          id={item.id}
                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label={item.name}
                        >
                          <div
                            className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} flex h-4 w-4 items-center justify-center rounded-sm p-1`}
                          >
                            <Icon icon={item.icon} className="h-3 w-3 shrink-0" />
                          </div>
                          <span>{item.name}</span>
                        </MenuItem>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>

                <Button
                  onPress={() => {
                    setImportModalType('file');
                  }}
                  aria-label="Import"
                  className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="file-import" /> <span className="hidden md:block">Import</span>
                </Button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <GridList
                aria-label="Files"
                data-testid="workspace-grid"
                className="grid grid-cols-[repeat(auto-fit,200px)] grid-rows-[repeat(auto-fit,200px)] gap-4 p-(--padding-md) data-empty:flex data-empty:justify-center"
                items={filesWithPresence}
                renderEmptyState={() => {
                  if (workspaceListFilter) {
                    return (
                      <div className="flex h-full w-full items-center justify-center">
                        <p className="notice subtle">
                          No documents found for <strong>{workspaceListFilter}</strong>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="flex w-full flex-col items-center justify-center gap-4">
                      <ProjectEmptyView
                        onCreateRequestCollectionWithRequest={createNewCollectionWithRequest}
                        onCreateDesignDocument={() => createNewDocument('empty-state')}
                        onImportFrom={() => setImportModalType('file')}
                      />
                      {createNewWorkspaceFetcher.data?.error && (
                        <div className="px-10">
                          <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
                            <Icon icon="triangle-exclamation" />
                            <span>{createNewWorkspaceFetcher.data?.error}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }}
              >
                {item => {
                  return (
                    <GridListItem
                      key={item.id}
                      id={item.id}
                      textValue={item.name}
                      // onAction is required for onPress with selectionMode='none' but we handle clicks in onPress
                      onAction={() => {}}
                      onAuxClick={e => {
                        if (e.button === 1) {
                          e.preventDefault();
                          item.action(true);
                        }
                      }}
                      onPress={e => {
                        item.action(isPrimaryClickModifier(e));
                      }}
                      className={`group flex aspect-square w-full flex-1 flex-col overflow-hidden rounded-md p-(--padding-md) ring-1 ring-(--hl-md) outline-hidden transition-all select-none hover:bg-(--hl-xs) hover:shadow-md hover:ring-(--hl-sm) focus:bg-(--hl-sm) focus:ring-(--hl-lg) ${item.loading ? 'animate-pulse' : ''}`}
                    >
                      <div className="flex h-5 gap-2">
                        <div className="flex h-full shrink-0 items-center gap-2 rounded-xs bg-(--hl-xs) pr-2 text-sm text-(--color-font)">
                          <div
                            className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} flex h-5 w-5 items-center justify-center rounded-s-sm px-2`}
                          >
                            <Icon
                              icon={item.loading ? 'spinner' : scopeToIconMap[item.scope]}
                              className={item.loading ? 'animate-spin' : ''}
                            />
                          </div>
                          <span>{item.label}</span>
                        </div>
                        <span className="flex-1" />
                        {activeProject && item.workspace && (
                          <WorkspaceCardDropdown
                            workspace={item.workspace}
                            mockServer={item.mockServer}
                            gitFilePath={item.gitFilePath || undefined}
                            apiSpec={item.apiSpec}
                            project={activeProject}
                          />
                        )}
                      </div>
                      <TooltipTrigger>
                        <span className="line-clamp-4 pt-4 text-base font-bold outline-hidden">{item.name}</span>
                        <Tooltip
                          offset={8}
                          className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                        >
                          <span>{item.name}</span>
                        </Tooltip>
                      </TooltipTrigger>
                      <div className="flex flex-1 flex-col justify-end gap-2 text-sm text-(--hl)">
                        {item.gitFilePath && (
                          <div className="flex items-center gap-2 text-sm">
                            <Icon icon="file-alt" />
                            <span className="truncate" title={item.gitFilePath}>
                              {item.gitFilePath}
                            </span>
                          </div>
                        )}
                        {item.version && <div className="flex-1 pt-2">{item.version}</div>}
                        {item.oasFormat && (
                          <div className="flex items-center gap-2 text-sm">
                            <Icon icon="file-alt" />
                            <span>{item.oasFormat}</span>
                          </div>
                        )}
                        {item.branch && (
                          <div className="flex items-center gap-2 text-sm">
                            <Icon icon="code-branch" />
                            <span className="truncate">{item.branch}</span>
                          </div>
                        )}
                        {Boolean(item.lastModifiedTimestamp) && (
                          <div className="flex items-center gap-2 truncate text-sm">
                            <Icon icon="clock" />
                            <TimeFromNow
                              title={text =>
                                `Last updated ${text}, and created on ${new Date(item.created).toLocaleDateString()}`
                              }
                              timestamp={item.lastModifiedTimestamp}
                            />
                            <span className="truncate">{item.lastCommit}</span>
                          </div>
                        )}
                        {(item.hasUncommittedChanges || item.hasUnpushedChanges) && (
                          <div className="flex items-center gap-2 text-sm text-[rgba(var(--color-warning-rgb),0.8)]">
                            <span>{item.hasUncommittedChanges ? 'Uncommitted changes' : 'Unpushed changes'}</span>
                          </div>
                        )}
                        {item.fileIssue && (
                          <div className="inline-flex w-fit items-center gap-2 text-sm text-[rgba(var(--color-warning-rgb),0.8)] outline-hidden">
                            <Icon className="text-(--color-warning)" icon="triangle-exclamation" />
                            <span>{item.fileIssue.kind === 'conflict' ? 'Merge in progress' : 'Invalid schema'}</span>
                          </div>
                        )}
                      </div>
                    </GridListItem>
                  );
                }}
              </GridList>
            </div>
          </div>
        ) : projects.length ? (
          <NoSelectedProjectView />
        ) : (
          <NoProjectView storageRules={storageRules} />
        )}
        {/* </Panel>
        </PanelGroup> */}
        {isNewProjectModalOpen && (
          <ProjectModal
            isOpen={isNewProjectModalOpen}
            onOpenChange={setIsNewProjectModalOpen}
            storageRules={storageRules}
          />
        )}
        {isUpdateProjectModalOpen && (
          <ProjectModal
            isOpen={isUpdateProjectModalOpen}
            onOpenChange={setIsUpdateProjectModalOpen}
            project={activeProject}
            gitRepository={activeProjectGitRepository || undefined}
            storageRules={storageRules}
          />
        )}
        {activeProject && newWorkspaceModalState?.isOpen && (
          <NewWorkspaceModal
            isOpen
            project={activeProject}
            storageRules={storageRules}
            scope={newWorkspaceModalState.scope}
            onCreateWorkspace={workspaceId => {
              if (
                newWorkspaceModalState.scope === 'collection' &&
                newWorkspaceModalState.source === 'first-request-pane'
              ) {
                setSelectedCollectionId(workspaceId);
              }
            }}
            redirectAfterCreate={newWorkspaceModalState.redirect}
            source={newWorkspaceModalState.source}
            onOpenChange={isOpen => {
              setNewWorkspaceModalState({
                scope: newWorkspaceModalState.scope,
                isOpen,
                redirect: newWorkspaceModalState.redirect,
              });
            }}
          />
        )}
        {activeProject && importModalType && (
          <ImportModal
            onHide={() => setImportModalType(null)}
            projectName={activeProject.name}
            from={{ type: importModalType }}
            organizationId={organizationId}
            defaultProjectId={activeProject._id}
          />
        )}
      </Fragment>
    </ErrorBoundary>
  );
};

export default Component;
