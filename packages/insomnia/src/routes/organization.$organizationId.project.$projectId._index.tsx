import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { useFetchers, useParams } from 'react-router';
import * as reactUse from 'react-use';

import {
  DASHBOARD_SORT_ORDERS,
  type DashboardSortOrder,
  dashboardSortOrderName,
  getAppWebsiteBaseURL,
} from '~/common/constants';
import { scopeToBgColorMap, scopeToIconMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { fuzzyMatchAll } from '~/common/misc';
import type { InsomniaFile } from '~/common/project';
import { sortMethodMap } from '~/common/sorting';
import type { GitRepository, Project, WorkspaceScope } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { AnalyticsEvent, trackOnceDaily } from '~/ui/analytics';
import { AvatarGroup } from '~/ui/components/avatar';
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
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useGitFileIssues } from '~/ui/hooks/use-git-file-issues';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { isPrimaryClickModifier } from '~/ui/utils';

export interface ProjectLoaderData {
  localFiles: InsomniaFile[];
  allFilesCount: number;
  documentsCount: number;
  environmentsCount: number;
  collectionsCount: number;
  mockServersCount: number;
  mcpClientsCount: number;
  projectsCount: number;
  activeProject?: Project;
  activeProjectGitRepository?: GitRepository;
  projects: (Project & { gitRepository?: GitRepository })[];
  remoteFilesPromise?: Promise<InsomniaFile[]>;
  projectsSyncStatusPromise?: Promise<Record<string, boolean>>;
}

const Component = () => {
  const { localFiles, activeProject, activeProjectGitRepository, projects, remoteFilesPromise } =
    useProjectLoaderData()!;
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const [remoteFiles] = useLoaderDeferData<InsomniaFile[]>(remoteFilesPromise, projectId);

  useEffect(() => {
    if (activeProject?.remoteId && remoteFiles) {
      console.log('[remote files] remote files loaded for project ui', remoteFiles.length);
    }
  }, [activeProject?.remoteId, remoteFiles]);

  const allFiles = useMemo(() => {
    return remoteFiles ? [...localFiles, ...remoteFiles] : localFiles;
  }, [localFiles, remoteFiles]);

  const { userSession } = useRootLoaderData()!;
  const pullFileFetcher = useInsomniaSyncPullRemoteFileActionFetcher();
  const loadingBackendProjects = useFetchers()
    .filter(
      fetcher => fetcher.formAction === `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
    )
    .map(f => f.formData?.get('backendProjectId'));

  const organizationData = useOrganizationLoaderData();
  const { presence } = useInsomniaEventStreamContext();
  const { issuesByWorkspaceId } = useGitFileIssues();
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const { billing } = useOrganizationPermissions();

  const projectFileIssues = Object.values(issuesByWorkspaceId);
  const hasProjectFileIssues = projectFileIssues.length > 0;
  const projectFileIssuesMessage =
    'There are issues with one or more Insomnia files in this project. Use the git CLI and your local file system to resolve them and continue.';

  useEffect(() => {
    if (!models.organization.isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { storagePromise } = storageRuleFetcher.data || {};

  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

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
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  const isUserOwner =
    organization &&
    userSession.accountId &&
    models.organization.isOwnerOfOrganization({ organization, accountId: userSession.accountId });
  const isPersonalOrg = organization && models.organization.isPersonalOrganization(organization);
  const greetingName = userSession.firstName || userSession.email.split('@')[0] || 'there';
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
    .map(file => {
      const workspacePresence = presence
        .filter(p => p.project === activeProject?.remoteId && p.file === file.id)
        .filter(p => p.acct !== userSession.accountId)
        .map(user => {
          return {
            key: user.acct,
            alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
            src: user.avatar,
          };
        });
      return {
        ...file,
        fileIssue: file.workspace ? issuesByWorkspaceId[file.workspace._id] : undefined,
        loading:
          loadingBackendProjects.includes(file.remoteId) ||
          (pullFileFetcher.formData?.get('backendProjectId') &&
            pullFileFetcher.formData?.get('backendProjectId') === file.remoteId),
        presence: workspacePresence,
      };
    })
    .map(file => ({
      ...file,
      action: (withTab?: boolean) => {
        // hack to workaround gridlist not have access to workspace scope
        if (file.scope === 'unsynced') {
          if (activeProject?.remoteId && file.remoteId) {
            return pullFileFetcher.submit({
              backendProjectId: file.remoteId,
              remoteId: activeProject.remoteId,
              organizationId,
            });
          }

          return;
        }

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

  const createNewCollection = () => setNewWorkspaceModalState({ scope: 'collection', isOpen: true });
  const createNewDocument = () => setNewWorkspaceModalState({ scope: 'design', isOpen: true });
  const createNewMockServer = () =>
    canCreateMockServer && setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true });
  const createNewGlobalEnvironment = () => setNewWorkspaceModalState({ scope: 'environment', isOpen: true });
  const createNewMcpClient = () => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true });

  const createNewCollectionWithRequest = () => {
    if (!activeProject) {
      return;
    }

    createNewWorkspaceFetcher.submit({
      organizationId,
      projectId,
      name: 'My first collection',
      scope: 'collection',
      withRequest: true,
    });
  };

  const canCreateMockServer = activeProject?._id;

  const createInProjectActionList: {
    id: string;
    name: string;
    icon: IconProp;
    action: () => void;
  }[] = [
    {
      id: 'new-collection',
      name: 'Request collection',
      icon: 'bars',
      action: createNewCollection,
    },
    {
      id: 'new-document',
      name: 'Design document',
      icon: 'file',
      action: createNewDocument,
    },
    {
      id: 'new-mcp-client',
      name: 'MCP Client',
      icon: ['fac', 'mcp'] as unknown as IconProp,
      action: createNewMcpClient,
    },
    ...(canCreateMockServer
      ? [
          {
            id: 'new-mock-server',
            name: 'Mock Server',
            icon: 'server' as IconName,
            action: createNewMockServer,
          },
        ]
      : []),
    {
      id: 'new-environment',
      name: 'Environment',
      icon: 'code',
      action: createNewGlobalEnvironment,
    },
  ];

  const isRemoteProjectInconsistent =
    activeProject && models.project.isRemoteProject(activeProject) && !storageRules.enableCloudSync;
  const isLocalProjectInconsistent =
    activeProject &&
    !models.project.isRemoteProject(activeProject) &&
    !models.project.isGitProject(activeProject) &&
    !storageRules.enableLocalVault;
  const isGitSyncProjectInconsistent =
    activeProject && models.project.isGitProject(activeProject) && !storageRules.enableGitSync;
  const isProjectInconsistent =
    isRemoteProjectInconsistent || isLocalProjectInconsistent || isGitSyncProjectInconsistent;

  return (
    <ErrorBoundary>
      <Fragment>
        <OrganizationTabList showActiveStatus={false} />
        <div className="px-4 pt-4">
          <FirstRequestCreation
            greetingName={greetingName}
            collectionItems={collectionItems}
            selectedCollectionId={selectedCollectionId}
            onSelectedCollectionChange={setSelectedCollectionId}
            onCreateCollection={() => {
              setNewWorkspaceModalState({ scope: 'collection', isOpen: true, redirect: false });
            }}
          />
        </div>
        {activeProject ? (
          <div className="flex w-full flex-col overflow-hidden">
            {billing.isActive ? null : (
              <div className="p-(--padding-md) pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
                  <p className="text-base">
                    <Icon icon="exclamation-triangle" className="mr-2" />
                    {isUserOwner
                      ? `Your ${isPersonalOrg ? 'personal account' : 'organization'} has unpaid past invoices. Please enter a new payment method to continue using Insomnia.`
                      : 'This organization has unpaid past invoices. Please ask the organization owner to enter a new payment method to continue using Insomnia.'}
                  </p>
                  {isUserOwner && (
                    <a
                      href={`${getAppWebsiteBaseURL()}/app/subscription/past-due`}
                      className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-font) px-4 py-1 text-sm font-semibold text-(--color-bg) ring-1 ring-transparent transition-all hover:bg-(--hl-md)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                    >
                      Update payment method
                    </a>
                  )}
                </div>
              </div>
            )}
            {billing?.expirationErrorMessage || billing?.expirationWarningMessage ? (
              <div className="p-(--padding-md) pb-0">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) p-(--padding-sm) text-(--color-font-warning) ${billing?.expirationWarningMessage ? 'bg-(--color-warning)/50' : 'bg-(--color-danger)/50'}`}
                >
                  <p className="text-base">
                    <Icon icon="exclamation-triangle" className="mr-2" />
                    {billing?.expirationErrorMessage || billing?.expirationWarningMessage}
                  </p>
                  {isUserOwner && (
                    <a
                      href="https://insomnia.rest/pricing/contact"
                      className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-font) px-4 py-1 text-sm font-semibold text-(--color-bg) ring-1 ring-transparent transition-all hover:bg-(--color-font)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                    >
                      Contact sales
                    </a>
                  )}
                </div>
              </div>
            ) : null}
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
            {isProjectInconsistent && (
              <div className="p-(--padding-md) pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
                  <p className="text-base">
                    <Icon icon="exclamation-triangle" className="mr-2" />
                    The organization owner mandates that projects must be created and stored using{' '}
                    {models.project.getProjectStorageTypeLabel(storageRules)}.
                  </p>
                  <Button
                    onPress={() => setIsUpdateProjectModalOpen(true)}
                    className="flex items-center justify-center rounded-xs border border-solid border-white px-2 py-1"
                  >
                    Update
                  </Button>
                </div>
              </div>
            )}
            {/* Show filter UI if there are files with presence or if the user has entered any filter input(even no match) */}
            {(filesWithPresence.length > 0 || workspaceListFilter) && (
              <div className="flex w-full max-w-xl justify-between gap-2 p-(--padding-md)">
                <SearchField
                  aria-label="Files filter"
                  className="group relative flex-1"
                  value={workspaceListFilter}
                  onChange={filter => {
                    setWorkspaceListFilter(filter);
                    if (filter.trim() !== '') {
                      trackOnceDaily(AnalyticsEvent.homepageFiltered);
                    }
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
                          <Icon icon={item.icon} />
                          <span>{item.name}</span>
                        </MenuItem>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>

                <Button
                  onPress={() => {
                    window.main.trackAnalyticsEvent({
                      event: AnalyticsEvent.importStarted,
                      properties: {
                        source: 'project',
                      },
                    });
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
                        onCreateDesignDocument={createNewDocument}
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
                      className={`flex aspect-square w-full flex-1 flex-col overflow-hidden rounded-md p-(--padding-md) ring-1 ring-(--hl-md) outline-hidden transition-all select-none hover:bg-(--hl-xs) hover:shadow-md hover:ring-(--hl-sm) focus:bg-(--hl-sm) focus:ring-(--hl-lg) ${item.loading ? 'animate-pulse' : ''}`}
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
                        {item.presence.length > 0 && <AvatarGroup size="small" maxAvatars={3} items={item.presence} />}
                        {activeProject && item.scope !== 'unsynced' && item.workspace && (
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
              if (newWorkspaceModalState.scope === 'collection' && newWorkspaceModalState.redirect === false) {
                setSelectedCollectionId(workspaceId);
              }
            }}
            redirectAfterCreate={newWorkspaceModalState.redirect}
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
