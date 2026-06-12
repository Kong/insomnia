import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { StorageRules } from 'insomnia-api';
import type { BaseModel, RequestGroup, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import {
  type Dispatch,
  type ForwardedRef,
  forwardRef,
  type SetStateAction,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, GridList, GridListItem, Input, SearchField, Tab, TabList, Tabs } from 'react-aria-components';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import * as reactUse from 'react-use';

import { Button as BasicButton } from '~/basic-components/button';
import type { SortOrder } from '~/common/constants';
import type { ChangeBufferEvent } from '~/common/database';
import { fuzzyMatchAll } from '~/common/misc';
import { getAllRemoteBackendProjectsOfOrg, getUnsyncedRemoteWorkspaces, type InsomniaFile } from '~/common/project';
import { sortMethodMap } from '~/common/sorting';
import type { SyncResult } from '~/konnect/sync';
import { AnalyticsEvent } from '~/ui/analytics';
import type { WorkspaceSortOrder } from '~/ui/components/dropdowns/sidebar-project-dropdown';
import { KongLogo } from '~/ui/components/kong-logo';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { KonnectSettingsModal } from '~/ui/components/modals/konnect-settings-modal';
import { EmptyNode } from '~/ui/components/sidebar/project-navigation-sidebar/empty-node';
import { KonnectSyncIntro } from '~/ui/components/sidebar/project-navigation-sidebar/konnect-sync-intro/konnect-sync-intro';
import { UnsyncedWorkspaceNode } from '~/ui/components/sidebar/project-navigation-sidebar/unsynced-workspace-node';
import uiEventBus, { CLOUD_SYNC_FILE_CHANGE } from '~/ui/event-bus';
import { projectKeys, useProjects, useSettings } from '~/ui/hooks/data';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useKonnectSync } from '~/ui/hooks/use-konnect-sync';
import insomniaLogo from '~/ui/images/insomnia-logo.svg';
import { isPrimaryClickModifier } from '~/ui/utils';

import { Icon } from '../../icon';
import {
  type AllRequestsAndMetaInWorkspace,
  COLLECTION_QUERY_KEY,
  collectionQueryKey,
  filterCollection,
  flattenCollectionChildren,
  getAllRequestsAndMetaByWorkspace,
  getWorkspacesByProjectIds,
  SIDEBAR_RELEVANT_DOC_TYPES,
  workspacesQueryKey,
} from './project-navigation-sidebar-utils';
import { ProjectNode } from './project-node';
import { PinnedHeaderNode, RequestNode } from './request-node';
import type { FlatItem } from './types';
import { useProjectNavigationSidebarNavigation } from './use-project-navigation-sidebar-navigation';
import { useSidebarDragAndDrop } from './use-sidebar-drag-and-drop';
import { WorkspaceNode } from './workspace-node';

interface ProjectNavigationSidebarProps {
  storageRules: StorageRules;
  activeNodeId?: string;
  activeTab: ProjectNavigationSidebarTabId;
  konnectSyncEnabled: boolean;
  onCreateProject: () => void;
  setActiveTab: Dispatch<SetStateAction<ProjectNavigationSidebarTabId | undefined>>;
}

export interface ProjectNavigationSidebarHandle {
  expandProject: (projectId: string) => void;
}

export type ProjectNavigationSidebarTabId = 'projects' | 'konnect';

const SidebarSearchField = ({
  value,
  isDisabled,
  onChange,
}: {
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
}) => (
  <SearchField
    aria-label="Projects filter"
    className="group relative flex-1"
    value={value}
    isDisabled={isDisabled}
    onChange={onChange}
  >
    <Input
      placeholder="Filter"
      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
    />
    <div className="absolute top-0 right-0 flex h-full items-center px-2">
      <Button
        aria-label="Clear search"
        className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
      >
        <Icon icon="close" />
      </Button>
    </div>
  </SearchField>
);

const SideBarTabList = ({
  konnectSyncEnabled,
  isScratchPad,
  nonKonnectProjectLength,
  konnectProjectsLength,
}: {
  konnectSyncEnabled: boolean;
  isScratchPad: boolean;
  nonKonnectProjectLength: number;
  konnectProjectsLength: number;
}) => {
  return (
    <TabList
      aria-label="Sidebar navigation"
      className="flex h-(--line-height-sm) w-full shrink-0 border-b border-solid border-b-(--hl-md)"
    >
      <Tab
        id="projects"
        className={`flex h-full shrink-0 items-center justify-between px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none ${konnectSyncEnabled ? 'cursor-pointer hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)' : 'text-(--color-font)!'}`}
        data-testid="sidebar-tab-projects"
      >
        {isScratchPad ? 'Projects' : `Projects (${nonKonnectProjectLength})`}
      </Tab>
      {konnectSyncEnabled && !isScratchPad && (
        <Tab
          id="konnect"
          className="flex h-full shrink-0 cursor-pointer items-center justify-between px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
          data-testid="sidebar-tab-konnect"
        >
          <span className="flex items-center gap-2">
            <KongLogo />
            Konnect ({konnectProjectsLength})
          </span>
        </Tab>
      )}
    </TabList>
  );
};

const NewProjectButton = ({ onPress, isDisabled }: { onPress: () => void; isDisabled?: boolean }) => (
  <BasicButton
    aria-label="Create new Project"
    onPress={onPress}
    isDisabled={isDisabled}
    className="flex h-full items-center justify-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
  >
    <Icon icon="plus" className="h-2.5 w-2.5" />
    <span>New Project</span>
  </BasicButton>
);

const ProjectNavigationSidebarInner = (
  { storageRules, konnectSyncEnabled, onCreateProject, activeTab, setActiveTab }: ProjectNavigationSidebarProps,
  ref: ForwardedRef<ProjectNavigationSidebarHandle>,
) => {
  const navigate = useNavigate();
  const { organizationId, projectId: activeProjectId } = useParams() as {
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const settings = useSettings();
  const queryClient = useQueryClient();
  const { data: projects = [] } = useProjects(organizationId);

  const [searchParams, _setSearchParams] = useSearchParams();
  const tabNavigate = useTabNavigate();

  const [collectionSortOrders, setCollectionSortOrders] = useState<Record<string, SortOrder>>({});
  const [projectWorkspaceSortOrder, setProjectWorkspaceSortOrder] = useState<Record<string, WorkspaceSortOrder>>({});
  const [unsyncedFilesByProjectId, setUnsyncedFilesByProjectId] = useState<Map<string, InsomniaFile[]>>(new Map());
  // Customized workspace sort orders by projectId
  const [localWorkspaceOrders, setLocalWorkspaceOrders] = reactUse.useLocalStorage<Record<string, string[]>>(
    `${organizationId}:local-workspace-orders`,
    {},
  );
  const [projectNavigationSidebarFilter, setProjectNavigationSidebarFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-navigation-sidebar-filter`,
    '',
  );
  const [konnectFilter, setKonnectFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-navigation-konnect-filter`,
    '',
  );
  const [expandedProjectAndWorkspaceIds, setExpandedProjectAndWorkspaceIds] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:nav-expanded-projects-and-workspaces`,
    [],
  );
  const isProjectTabActive = activeTab === 'projects';
  const { syncing, progress, startSync, cancelSync } = useKonnectSync();

  const nonKonnectProjects = projects.filter(p => !p.konnectControlPlaneId);
  const konnectProjects = projects.filter(p => p.konnectControlPlaneId != null);
  const [filterInputValue, setFilterInputValue] = useState(projectNavigationSidebarFilter || '');
  // Debounce update filter
  reactUse.useDebounce(() => setProjectNavigationSidebarFilter(filterInputValue), 300, [filterInputValue]);
  // ref to track whether we are currently fetching unsynced files for cloud sync projects to avoid duplicate requests
  const isFetchingUnsyncedFilesRef = useRef(false);

  const syncKonnectProjectsAndNotifyRef = useRef<() => Promise<void>>(async () => {});

  const isScratchPad = activeProjectId === models.project.SCRATCHPAD_PROJECT_ID;
  // show konnect or none-konnect projects based on selected tab
  const activeProjects = useMemo(
    () => projects.filter(isProjectTabActive ? p => !p.konnectControlPlaneId : p => p.konnectControlPlaneId != null),
    [isProjectTabActive, projects],
  );
  const projectIds = useMemo(() => activeProjects.map(p => p._id), [activeProjects]);

  const cloudSyncProjects = useMemo(
    () => activeProjects.filter(p => models.project.isRemoteProject(p)),
    [activeProjects],
  );
  // Generate a stable string key to trigger getOrFetchUnsyncedFiles when the list of cloud sync projects changes.
  const cloudSyncProjectIdsKey = useMemo(
    () =>
      cloudSyncProjects
        .map(p => p._id)
        .sort()
        .join(','),
    [cloudSyncProjects],
  );

  const getAllRemoteFilesByProjectId = useCallback(async () => {
    if (!cloudSyncProjectIdsKey) return new Map();
    // Avoid duplicate fetch
    if (isFetchingUnsyncedFilesRef.current) {
      return;
    }
    const cloudSyncProjectIds = cloudSyncProjectIdsKey.split(',');
    const result = new Map<string, InsomniaFile[]>();
    isFetchingUnsyncedFilesRef.current = true;

    // set up a map of remoteId to projectId for all cloud sync projects.
    const remoteIdToProjectIdMap = new Map<string, string>();
    for (const projectId of cloudSyncProjectIds) {
      const project = await services.project.get(projectId);
      if (project && 'remoteId' in project && project.remoteId) {
        remoteIdToProjectIdMap.set(project.remoteId, projectId);
      }
    }

    try {
      const files = await getAllRemoteBackendProjectsOfOrg({ organizationId });
      const filesByProjectId = new Map<string, InsomniaFile[]>();
      // group files by projectId
      for (const file of files) {
        const projectId = remoteIdToProjectIdMap.get(file.teamProjectId);
        if (projectId) {
          if (!filesByProjectId.has(projectId)) {
            filesByProjectId.set(projectId, []);
          }
          filesByProjectId.get(projectId)?.push({
            id: file.rootDocumentId,
            name: file.name,
            scope: 'unsynced',
            label: 'Unsynced',
            remoteId: file.id,
            created: 0,
            lastModifiedTimestamp: 0,
          });
        }
      }

      for (const [projectId, files] of filesByProjectId.entries()) {
        result.set(projectId, files);
      }
    } catch (error) {
      console.error(`Failed to fetch unsynced files for organization ${organizationId}`, error);
      for (const projectId of cloudSyncProjectIds) {
        result.set(projectId, []);
      }
    }

    isFetchingUnsyncedFilesRef.current = false;
    return setUnsyncedFilesByProjectId(result);
  }, [organizationId, cloudSyncProjectIdsKey]);

  const syncKonnectProjectsAndNotify = async () => {
    const result = await startSync(organizationId);
    setLastSyncResult(result ?? null);
    setShowSyncDetails(false);
    setCopiedReason(null);
  };
  syncKonnectProjectsAndNotifyRef.current = syncKonnectProjectsAndNotify;

  const handleSync = async () => {
    if (!konnectSyncEnabled) {
      return;
    }

    const isResync = konnectProjects.length > 0;
    if (isResync) {
      showModal(AskModal, {
        title: 'Sync updates from Konnect',
        message: (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <KongLogo width={20} height={20} />
                <span className="text-sm font-medium">Konnect</span>
              </div>
              <span className="text-(--hl)">→</span>
              <div className="flex items-center gap-1">
                <img src={insomniaLogo} alt="Insomnia" className="h-5 w-5" />
                <span className="text-sm font-medium">Insomnia</span>
              </div>
            </div>
            <p className="text-sm text-(--hl)">
              Sync the latest changes from your Konnect organization into Insomnia. This will:
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Keep your local custom changes (never pushed to Konnect)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Update existing resources to match Konnect
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Remove collections or environments tied to control planes, services, or routes deleted in Konnect
              </li>
            </ul>
          </div>
        ),
        yesText: 'Sync Now',
        noText: 'Cancel',
        color: 'surprise',
        onDone: async (confirmed: boolean) => {
          if (confirmed) {
            await syncKonnectProjectsAndNotify();
          }
        },
      });
    } else {
      await syncKonnectProjectsAndNotify();
    }
  };

  // Given a changed request/group/meta document, find its parent workspaceIds
  const findCollectionWorkspaceIdsForChangedDoc = useCallback(
    (doc: BaseModel) => {
      const workspaceIds: string[] = [];
      const cachedCollections = queryClient.getQueriesData<AllRequestsAndMetaInWorkspace>({
        queryKey: [COLLECTION_QUERY_KEY],
      });
      for (const [queryKey, data] of cachedCollections) {
        const workspaceId = queryKey[1] as string;
        if (!data) {
          continue;
        }
        if (
          doc.parentId === workspaceId ||
          data.allRequests.some(request => request._id === doc._id || request._id === doc.parentId)
        ) {
          workspaceIds.push(workspaceId);
        }
      }
      return workspaceIds;
    },
    [queryClient],
  );

  useEffect(() => {
    if (projectNavigationSidebarFilter) {
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.projectListFiltered,
      });
    }
  }, [projectNavigationSidebarFilter]);

  useEffect(() => {
    getAllRemoteFilesByProjectId();
    const updateUnsyncedFiles = () => {
      getAllRemoteFilesByProjectId();
    };
    // Subscribe to changes in unsynced workspace files to keep the sidebar up to date.
    // The subscribe is triggered in insomnia-event-stream-context when cloud sync files is changed remotely
    return uiEventBus.on(CLOUD_SYNC_FILE_CHANGE, updateUnsyncedFiles);
  }, [getAllRemoteFilesByProjectId, organizationId]);

  // Listen for local database changes and invalidate only the affected query keys,
  useEffect(() => {
    return window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
      // Ids of the projects whose workspaces data need to be invalidated
      const projectIdsToInvalidate: string[] = [];
      // Ids of the workspaces whose collection data need to be invalidated
      const workspaceIdsToInvalidate: string[] = [];
      let shouldInvalidateProjectList = false;

      for (const [, doc] of changes) {
        if (!SIDEBAR_RELEVANT_DOC_TYPES.includes(doc.type)) {
          continue;
        }
        if (doc.type === models.project.type) {
          // A project was mutated, need to refresh the whole project list
          shouldInvalidateProjectList = true;
          continue;
        }
        if (doc.type === models.workspace.type) {
          // A workspace was mutated, refresh the workspace list under its parent project and the collection data.
          projectIdsToInvalidate.push(doc.parentId);
          continue;
        }
        // request/requestGroup/meta was mutated, find the parent workspace and refresh its collection data.
        findCollectionWorkspaceIdsForChangedDoc(doc).forEach(id => workspaceIdsToInvalidate.push(id));
      }
      // Invalidate all affected queries at once after processing the whole batch of changes.
      if (shouldInvalidateProjectList) {
        queryClient.invalidateQueries({ queryKey: projectKeys.list(organizationId) });
      }
      projectIdsToInvalidate.forEach(projectId =>
        queryClient.invalidateQueries({ queryKey: workspacesQueryKey(projectId) }),
      );
      workspaceIdsToInvalidate.forEach(workspaceId =>
        queryClient.invalidateQueries({ queryKey: collectionQueryKey(workspaceId) }),
      );
    });
  }, [queryClient, organizationId, findCollectionWorkspaceIdsForChangedDoc]);

  // Cached of workspaces by parent projectId
  const workspacesByProjectId = useQueries({
    queries: projectIds.map(projectId => ({
      queryKey: workspacesQueryKey(projectId),
      queryFn: async () => (await getWorkspacesByProjectIds([projectId])).get(projectId) ?? [],
    })),
    combine: useCallback(
      (results: UseQueryResult<Workspace[]>[]) => {
        const map = new Map<string, Workspace[]>();
        projectIds.forEach((projectId, index) => map.set(projectId, results[index]?.data ?? []));
        return map;
      },
      [projectIds],
    ),
  });

  // Get the list of collection workspace ids that should be cached based on the current filter and expanded projects/workspaces. Only collection workspaces are cached because they are the only ones with requests/groups that need to be displayed in the tree — for non-collection workspaces we only display the workspace name, so no extra data fetching is needed.
  const collectionWorkspaceIds = useMemo(() => {
    const ids: string[] = [];
    projectIds.forEach(projectId => {
      (workspacesByProjectId.get(projectId) || []).forEach(workspace => {
        if (
          workspace.scope === 'collection' &&
          (!!projectNavigationSidebarFilter || (expandedProjectAndWorkspaceIds || []).includes(workspace._id))
        ) {
          ids.push(workspace._id);
        }
      });
    });
    return ids;
  }, [projectIds, workspacesByProjectId, projectNavigationSidebarFilter, expandedProjectAndWorkspaceIds]);

  // Cached collection workspace data including all requests/groups and their meta (e.g. for sorting) by workspaceId
  const collectionByWorkspaceId = useQueries({
    queries: collectionWorkspaceIds.map(workspaceId => ({
      queryKey: collectionQueryKey(workspaceId),
      queryFn: async () => (await getAllRequestsAndMetaByWorkspace([workspaceId])).get(workspaceId),
    })),
    combine: useCallback(
      (results: UseQueryResult<AllRequestsAndMetaInWorkspace | undefined>[]) => {
        const map = new Map<string, AllRequestsAndMetaInWorkspace>();
        collectionWorkspaceIds.forEach((workspaceId, index) => {
          const data = results[index]?.data;
          if (data) {
            map.set(workspaceId, data);
          }
        });
        return map;
      },
      [collectionWorkspaceIds],
    ),
  });

  // Build the flat tree synchronously from the cached query data
  const flatItems = useMemo<FlatItem[]>(() => {
    const buildWorkspaceAndCollectionData = (): FlatItem[] => {
      const items: FlatItem[] = [];
      const workspacesByProject = workspacesByProjectId;
      const collectionChildrenAndMetaByWorkspaceId = collectionByWorkspaceId;
      for (const project of activeProjects) {
        const projectId = project._id;
        const isProjectCollapsed = !(expandedProjectAndWorkspaceIds ?? []).includes(projectId);
        items.push({
          kind: 'project',
          organizationId,
          doc: project,
          collapsed: isProjectCollapsed,
          hidden: false,
        });
        const workspaces = workspacesByProject.get(projectId) || [];
        const workspaceOrder = projectWorkspaceSortOrder[projectId] || 'type-manual';
        let sortedWorkspaces: Workspace[] = [];
        if (workspaceOrder === 'type-manual') {
          const localOrder = localWorkspaceOrders?.[projectId];
          if (localOrder) {
            const orderIndexByWorkspaceId = new Map(localOrder.map((workspaceId, index) => [workspaceId, index]));
            sortedWorkspaces = [...workspaces].sort((a, b) => {
              const ai = orderIndexByWorkspaceId.get(a._id) ?? Infinity;
              const bi = orderIndexByWorkspaceId.get(b._id) ?? Infinity;
              return ai - bi;
            });
          } else {
            sortedWorkspaces = [...workspaces].sort((a, b) => sortMethodMap['created-asc'](a, b));
          }
        } else {
          sortedWorkspaces = [...workspaces].sort((a, b) => sortMethodMap[workspaceOrder](a, b));
        }

        const unsyncedWorkspaces = models.project.isRemoteProject(project)
          ? getUnsyncedRemoteWorkspaces(unsyncedFilesByProjectId.get(projectId) || [], sortedWorkspaces)
          : [];
        const allWorkspaces = [...sortedWorkspaces, ...unsyncedWorkspaces];
        // If there is no workspace under the project, show an empty workspace if no active filter
        if (allWorkspaces.length === 0 && !projectNavigationSidebarFilter) {
          items.push({
            kind: 'emptyProject',
            organizationId,
            project,
            hidden: isProjectCollapsed,
            doc: { _id: `empty-project-${projectId}`, name: '' },
          });
        }

        for (const workspace of allWorkspaces) {
          if (workspace.scope === 'unsynced') {
            items.push({
              kind: 'unsyncedWorkspace',
              organizationId,
              project: project,
              doc: {
                // ensure _id is present in doc for unsynced workspace flat item
                _id: workspace.id,
                ...workspace,
              },
              collapsed: false,
              hidden: isProjectCollapsed,
            });
          } else {
            const { scope, _id: workspaceId } = workspace as Workspace;
            const isCollection = scope === 'collection';
            // Only collection workspace has nested children
            const isWorkspaceCollapsed = !(
              isCollection && (expandedProjectAndWorkspaceIds ?? []).includes(workspaceId)
            );

            items.push({
              kind: 'workspace',
              organizationId,
              project: project,
              doc: workspace as Workspace,
              collapsed: isWorkspaceCollapsed,
              hidden: isProjectCollapsed,
            });

            const allRequestsAndMetaInWorkspace = collectionChildrenAndMetaByWorkspaceId.get(workspaceId);
            // build collection children if it's a collection workspace and parent workspace and project are not collapsed or there is an active filter
            const shouldHideCollectionChildren = isWorkspaceCollapsed || isProjectCollapsed;
            let collectionChildren =
              (!shouldHideCollectionChildren || !!projectNavigationSidebarFilter) && allRequestsAndMetaInWorkspace
                ? flattenCollectionChildren(
                    workspaceId,
                    shouldHideCollectionChildren,
                    allRequestsAndMetaInWorkspace,
                    collectionSortOrders[workspaceId] || 'type-manual',
                  )
                : [];

            if (projectNavigationSidebarFilter) {
              // apply filter to collection children first
              collectionChildren = filterCollection(collectionChildren, projectNavigationSidebarFilter);
              const collectionChildMatchesFilter = collectionChildren.some(child => !child.hidden);
              const workspaceMatchesFilter = Boolean(
                fuzzyMatchAll(
                  projectNavigationSidebarFilter.toLowerCase(),
                  // Todo: support remote files (cloud sync) in filter
                  [workspace.name?.toLowerCase() || ''],
                  { splitSpace: true, loose: true },
                )?.indexes,
              );
              const shouldHide = !collectionChildMatchesFilter && !workspaceMatchesFilter;
              // If workspace or any of its collection child matches the filter, show the workspace; otherwise hide
              items.find(i => i.kind === 'workspace' && i.doc._id === workspaceId)!.hidden = shouldHide;
            }
            // Show pinned collection children when the workspace is expanded
            const pinnedCollectionChildren = shouldHideCollectionChildren
              ? []
              : // Filter out pinned requests by pinned attribute. Besides, when there is an active filter, also filter out un-matched requests.
                collectionChildren.filter(
                  child => child.pinned && !(projectNavigationSidebarFilter ? child.hidden : false),
                );

            if (pinnedCollectionChildren.length > 0) {
              items.push({
                kind: 'pinnedHeader',
                hidden: false,
                doc: { _id: `${workspaceId}-pinned-header`, name: 'Pinned' },
              });
            }

            pinnedCollectionChildren.forEach((child, idx) => {
              items.push({
                kind: 'pinnedRequest',
                organizationId,
                project: project,
                workspace: workspace as Workspace,
                children: child.children,
                ancestors: child.ancestors,
                doc: child.doc,
                collapsed: child.collapsed,
                hidden: false,
                level: child.level,
                pinned: child.pinned,
                isFirstPinned: idx === 0,
                isLastPinned: idx === pinnedCollectionChildren.length - 1,
              });
            });

            collectionChildren.forEach(child => {
              items.push({
                kind: 'collectionChild',
                organizationId,
                project: project,
                workspace: workspace as Workspace,
                children: child.children,
                ancestors: child.ancestors,
                doc: child.doc,
                collapsed: child.collapsed,
                hidden: child.hidden,
                level: child.level,
                pinned: child.pinned,
              });
              if (
                models.requestGroup.isRequestGroupId(child.doc._id) &&
                child.children?.length === 0 &&
                !projectNavigationSidebarFilter
              ) {
                // If there is a request group with no children, add an empty folder node
                items.push({
                  kind: 'emptyFolder',
                  organizationId,
                  project,
                  workspace: workspace as Workspace,
                  requestGroup: child.doc as RequestGroup,
                  doc: { _id: `empty-folder-${child.doc._id}`, name: '' },
                  hidden: child.collapsed,
                  level: child.level,
                });
              }
            });

            if (collectionChildren.length === 0 && !shouldHideCollectionChildren && !projectNavigationSidebarFilter) {
              items.push({
                kind: 'emptyCollection',
                organizationId,
                project: project,
                workspace: workspace as Workspace,
                doc: { _id: `empty-collection-${(workspace as Workspace)._id}`, name: '' },
                hidden: false,
              });
            }
          }
        }

        // If project or any of its descendant workspace/collection child matches the filter, show the project; otherwise hide
        if (projectNavigationSidebarFilter) {
          const projectMatchesFilter = project.name
            ?.toLowerCase()
            .includes(projectNavigationSidebarFilter.toLowerCase());
          const hasVisibleWorkspace = items.some(
            i => i.kind === 'workspace' && i.project._id === projectId && !i.hidden,
          );
          const shouldHideProject = !projectMatchesFilter && !hasVisibleWorkspace;
          items.find(i => i.kind === 'project' && i.doc._id === projectId)!.hidden = shouldHideProject;
        }
      }

      // If there is an active filter, expand all items to show matched results and their ancestors
      if (projectNavigationSidebarFilter) {
        items.forEach(item => {
          if ('collapsed' in item) {
            item.collapsed = false;
          }
        });
      }

      return items;
    };
    return buildWorkspaceAndCollectionData();
  }, [
    workspacesByProjectId,
    collectionByWorkspaceId,
    collectionSortOrders,
    projectWorkspaceSortOrder,
    expandedProjectAndWorkspaceIds,
    localWorkspaceOrders,
    organizationId,
    projectNavigationSidebarFilter,
    activeProjects,
    unsyncedFilesByProjectId,
  ]);

  const handleLocalWorkspaceReorder = useCallback(
    (
      sourceProjectId: string,
      targetProjectId: string,
      draggedId: string,
      targetWorkspaceId: string | null,
      dropPosition: 'before' | 'after',
    ) => {
      const isMoveToDifferentProject = sourceProjectId !== targetProjectId;
      const workspaces = queryClient.getQueryData<Workspace[]>(workspacesQueryKey(targetProjectId)) || [];
      const currentWorkspaceSortOrder = projectWorkspaceSortOrder[targetProjectId] || 'type-manual';
      // Get the base order of workspace before re-order
      const baseOrder =
        // if current order is manual, use the current order in local state or default sort by created time; otherwise use current order to sort
        currentWorkspaceSortOrder === 'type-manual'
          ? localWorkspaceOrders?.[targetProjectId] ||
            [...workspaces].sort((a, b) => sortMethodMap['created-asc'](a, b)).map(w => w._id)
          : [...workspaces].sort((a, b) => sortMethodMap[currentWorkspaceSortOrder](a, b)).map(w => w._id);
      const reordered = (baseOrder as string[]).filter((id: string) => id !== draggedId);

      if (targetWorkspaceId === null) {
        // Drop workspace into a project, add it to the start of the workspace list
        reordered.unshift(draggedId);
      } else {
        const targetIdx = reordered.indexOf(targetWorkspaceId);
        if (!isMoveToDifferentProject && targetIdx === -1) return;
        reordered.splice(
          targetIdx === -1 ? reordered.length : dropPosition === 'before' ? targetIdx : targetIdx + 1,
          0,
          draggedId,
        );
      }

      if (isMoveToDifferentProject || currentWorkspaceSortOrder !== 'type-manual') {
        // If the current order is not manual, set the order to manual after re-order to persist the custom order
        setProjectWorkspaceSortOrder(prev => ({ ...prev, [targetProjectId]: 'type-manual' }));
      }
      setLocalWorkspaceOrders({ ...localWorkspaceOrders, [targetProjectId]: reordered });
    },
    [projectWorkspaceSortOrder, setLocalWorkspaceOrders, localWorkspaceOrders, queryClient],
  );

  const toggleProjectOrWorkspace = useCallback(
    (projectOrWorkspaceId: string) => {
      // Do not update toggle state if there is an active filter
      if (!projectNavigationSidebarFilter) {
        const expandedIds = expandedProjectAndWorkspaceIds || [];
        const isExpanded = expandedIds.includes(projectOrWorkspaceId);
        setExpandedProjectAndWorkspaceIds(
          isExpanded ? expandedIds.filter(id => id !== projectOrWorkspaceId) : [...expandedIds, projectOrWorkspaceId],
        );
      }
    },
    [expandedProjectAndWorkspaceIds, projectNavigationSidebarFilter, setExpandedProjectAndWorkspaceIds],
  );

  const expandProjectOrWorkspaces = useCallback(
    (projectOrWorkspaceIds: string[]) => {
      // Do not update toggle state if there is an active filter
      if (!projectNavigationSidebarFilter) {
        const expandedIds = expandedProjectAndWorkspaceIds || [];
        const newExpandedIds = Array.from(new Set([...expandedIds, ...projectOrWorkspaceIds]));
        // Avoid updating state if there is no change in expanded ids to prevent unnecessary re-render
        const hasNewIds = newExpandedIds.some(id => !expandedIds.includes(id));
        if (hasNewIds) {
          setExpandedProjectAndWorkspaceIds(newExpandedIds);
        }
      }
    },
    [expandedProjectAndWorkspaceIds, projectNavigationSidebarFilter, setExpandedProjectAndWorkspaceIds],
  );

  useImperativeHandle(
    ref,
    () => ({
      expandProject(projectId: string) {
        expandProjectOrWorkspaces([projectId]);
      },
    }),
    [expandProjectOrWorkspaces],
  );

  const toggleRequestGroups = useCallback(
    async (requestGroupIds: string[], workspace: Workspace, collapsed?: boolean) => {
      if (requestGroupIds.length === 0) {
        return;
      }

      if (projectNavigationSidebarFilter) {
        return;
      }

      const requestGroupMetas = await Promise.all(
        requestGroupIds.map(requestGroupId => services.requestGroupMeta.getByParentId(requestGroupId)),
      );
      // Resolve the next collapsed state for each toggled request group.
      const nextStates = requestGroupIds.map((requestGroupId, index) => {
        const requestGroupMeta = requestGroupMetas[index];
        return {
          requestGroupId,
          collapsed: collapsed ?? (requestGroupMeta ? !requestGroupMeta.collapsed : false),
        };
      });
      const collapsedByRequestGroupId = new Map(
        nextStates.map(({ requestGroupId, collapsed }) => [requestGroupId, collapsed]),
      );

      // Optimistically update the cached collection so the tree re-renders immediately.
      queryClient.setQueryData<AllRequestsAndMetaInWorkspace>(collectionQueryKey(workspace._id), previous => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          requestGroupMetas: previous.requestGroupMetas.map(requestGroupMeta =>
            collapsedByRequestGroupId.has(requestGroupMeta.parentId)
              ? { ...requestGroupMeta, collapsed: collapsedByRequestGroupId.get(requestGroupMeta.parentId)! }
              : requestGroupMeta,
          ),
        };
      });

      // Persist the change to database
      await Promise.all(
        nextStates.map(({ requestGroupId, collapsed }) =>
          services.requestGroupMeta.updateOrCreateForParentId(requestGroupId, { collapsed }),
        ),
      );
    },
    [projectNavigationSidebarFilter, queryClient],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const visibleFlatItems = useMemo(() => flatItems.filter(i => !i.hidden), [flatItems]);
  const virtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: visibleFlatItems.length,
    estimateSize: useCallback(() => 32, []),
    overscan: 30,
    getItemKey: index => visibleFlatItems[index].doc._id,
  });
  const sidebarDragAndDropHooks = useSidebarDragAndDrop({
    flatItems,
    organizationId,
    virtualizer,
    onWorkspaceReorder: handleLocalWorkspaceReorder,
    expandedProjectAndWorkspaceIds,
  });
  const { selectedItemId, routeInfo } = useProjectNavigationSidebarNavigation({
    setActiveTab,
    toggleRequestGroups,
    expandProjectOrWorkspaces,
    visibleFlatItems,
    virtualizer,
  });
  const selectedKeys =
    selectedItemId && visibleFlatItems.findIndex(item => item.doc._id === selectedItemId) !== -1
      ? [selectedItemId]
      : [];

  const { hasKonnectPat } = settings;
  const showKonnectSyncIntro = konnectSyncEnabled && !isProjectTabActive && !hasKonnectPat;
  const [showKonnectConfigModal, setShowKonnectConfigModal] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [copiedReason, setCopiedReason] = useState<string | null>(null);
  const skippedRoutesByReason = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { routeName, reason, serviceName } of lastSyncResult?.skippedRoutes ?? []) {
      const list = map.get(reason) ?? [];
      list.push(`${routeName} — ${serviceName}`);
      map.set(reason, list);
    }
    return map;
  }, [lastSyncResult]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="global-navigation-sidebar">
      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as ProjectNavigationSidebarTabId)}>
        <SideBarTabList
          konnectSyncEnabled={konnectSyncEnabled}
          isScratchPad={isScratchPad}
          nonKonnectProjectLength={nonKonnectProjects.length}
          konnectProjectsLength={konnectProjects.length}
        />
      </Tabs>
      {showKonnectSyncIntro ? (
        <KonnectSyncIntro onConfigure={() => setShowKonnectConfigModal(true)} />
      ) : (
        <>
          <div className="flex justify-between gap-1 p-(--padding-sm)">
            <SidebarSearchField
              value={isProjectTabActive ? filterInputValue : (konnectFilter ?? '')}
              isDisabled={projects.length === 0}
              onChange={isProjectTabActive ? setFilterInputValue : setKonnectFilter}
            />
            {isProjectTabActive ? (
              !isScratchPad && <NewProjectButton onPress={onCreateProject} isDisabled={projects.length === 0} />
            ) : (
              <div className="flex items-center gap-1">
                {syncing ? (
                  <Button
                    aria-label="Cancel sync"
                    onPress={cancelSync}
                    className="flex h-full items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none"
                  >
                    Cancel
                    <Icon icon="stop-circle" />
                  </Button>
                ) : (
                  <Button
                    aria-label="Sync Konnect"
                    onPress={handleSync}
                    className="flex h-full items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none"
                  >
                    <Icon icon="refresh" />
                    Sync
                  </Button>
                )}
                <Button
                  aria-label="Konnect settings"
                  onPress={() => setShowKonnectConfigModal(true)}
                  className="flex aspect-square h-full items-center justify-center rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none"
                >
                  <Icon icon="gear" />
                </Button>
              </div>
            )}
          </div>

          {!isProjectTabActive && syncing && (
            <p className="truncate px-4 pb-1 text-xs text-(--hl) italic">{progress}</p>
          )}

          <div
            ref={parentRef}
            className="group/tree flex-1 overflow-y-auto pb-(--padding-sm)"
            data-testid="project-navigation-tree-container"
          >
            <GridList
              aria-label="Project Navigation Tree"
              items={virtualizer.getVirtualItems()}
              style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
              className="outline-hidden"
              selectedKeys={selectedKeys}
              selectionMode="single"
              dragAndDropHooks={sidebarDragAndDropHooks}
            >
              {virtualItem => {
                const item = visibleFlatItems[virtualItem.index];
                if (!item) return null;

                return (
                  <GridListItem
                    // Prefix pinned-request to the key and id to ensure pinned items have a different key and id from non-pinned items with the same doc._id
                    key={`${item.kind === 'pinnedRequest' ? 'pinned-request-' : ''}${virtualItem.key}`}
                    id={`${item.kind === 'pinnedRequest' ? 'pinned-request-' : ''}${item.doc._id}`}
                    textValue={item.doc.name || item.kind}
                    onAuxClick={e => {
                      if (e.button === 1 && item.kind === 'collectionChild') {
                        e.preventDefault();
                        tabNavigate(
                          {
                            organization: organizationId,
                            project: item.project,
                            workspace: item.workspace,
                            item: item.doc,
                          },
                          { withTab: true, shouldNavigate: true, searchParams },
                        );
                      }
                    }}
                    onPress={async e => {
                      const docId = item.doc._id;
                      if (item.kind === 'project') {
                        if (routeInfo?.resourceId === docId) {
                          toggleProjectOrWorkspace(docId);
                        } else {
                          !isScratchPad && window.main.trackAnalyticsEvent({ event: AnalyticsEvent.projectSwitched });
                          !isScratchPad && navigate(`/organization/${organizationId}/project/${docId}`);
                        }
                      } else if (item.kind === 'workspace') {
                        if (routeInfo?.resourceId === docId && routeInfo?.routeId !== 'runner') {
                          toggleProjectOrWorkspace(docId);
                        } else {
                          tabNavigate(
                            {
                              organization: organizationId,
                              project: item.project,
                              workspace: item.doc,
                              item: item.doc,
                            },
                            { withTab: isPrimaryClickModifier(e), shouldNavigate: true, searchParams },
                          );
                        }
                      } else if (item.kind === 'collectionChild' || item.kind === 'pinnedRequest') {
                        if (
                          routeInfo?.resourceId === docId &&
                          models.requestGroup.isRequestGroupId(docId) &&
                          routeInfo?.routeId !== 'runner'
                        ) {
                          toggleRequestGroups([docId], item.workspace);
                        } else {
                          tabNavigate(
                            {
                              organization: organizationId,
                              project: item.project,
                              workspace: item.workspace,
                              item: item.doc,
                            },
                            { withTab: isPrimaryClickModifier(e), shouldNavigate: true, searchParams },
                          );
                        }
                      }
                    }}
                    className="group outline-hidden select-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {item.kind === 'project' && (
                      <ProjectNode
                        item={item}
                        onToggle={toggleProjectOrWorkspace}
                        storageRules={storageRules}
                        sortOrder={projectWorkspaceSortOrder[item.doc._id] || 'type-manual'}
                        onSortOrderChange={newSortOrder =>
                          setProjectWorkspaceSortOrder(prev => {
                            const newProjectWorkspaceSortOrder = { ...prev, [item.doc._id]: newSortOrder };
                            return newProjectWorkspaceSortOrder;
                          })
                        }
                      />
                    )}

                    {item.kind === 'workspace' && (
                      <WorkspaceNode
                        item={item}
                        onToggle={toggleProjectOrWorkspace}
                        sortOrder={collectionSortOrders[item.doc._id] || 'type-manual'}
                        onSortOrderChange={newSortOder => {
                          if (item.doc.scope === 'collection') {
                            setCollectionSortOrders(prev => {
                              const newCollectionSortOrders = { ...prev, [item.doc._id]: newSortOder };
                              return newCollectionSortOrders;
                            });
                          }
                        }}
                      />
                    )}

                    {item.kind === 'pinnedHeader' && <PinnedHeaderNode />}

                    {item.kind === 'collectionChild' && (
                      <RequestNode item={item} onToggleFolder={toggleRequestGroups} />
                    )}

                    {item.kind === 'pinnedRequest' && <RequestNode item={item} onToggleFolder={toggleRequestGroups} />}

                    {item.kind === 'unsyncedWorkspace' && <UnsyncedWorkspaceNode item={item} />}

                    {item.kind === 'emptyProject' || item.kind === 'emptyCollection' || item.kind === 'emptyFolder' ? (
                      <EmptyNode item={item} storageRules={storageRules} />
                    ) : null}
                  </GridListItem>
                );
              }}
            </GridList>
          </div>
          {!isProjectTabActive && lastSyncResult && (
            <div
              className={`m-2 flex items-start justify-between gap-2 rounded-sm p-3 text-xs ${
                !lastSyncResult.success
                  ? 'bg-[rgba(58,18,8,1)]'
                  : lastSyncResult.skippedRoutes.length > 0
                    ? 'bg-[rgba(250,173,20,0.15)]'
                    : 'bg-[rgba(82,196,26,0.15)]'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon
                  icon={
                    lastSyncResult.success && lastSyncResult.skippedRoutes.length === 0
                      ? 'circle-check'
                      : 'exclamation-triangle'
                  }
                  className={lastSyncResult.success && lastSyncResult.skippedRoutes.length === 0 ? 'mt-1.5' : 'mt-1'}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-(--color-font)">
                    {lastSyncResult.success
                      ? lastSyncResult.skippedRoutes.length > 0
                        ? 'Sync complete, with warnings'
                        : 'Sync complete'
                      : 'Sync failed'}
                  </p>
                  <p className="mt-0.5 text-(--hl)">
                    {!lastSyncResult.success
                      ? lastSyncResult.error
                      : lastSyncResult.routes.created === 0 &&
                          lastSyncResult.routes.updated === 0 &&
                          lastSyncResult.routes.deleted === 0 &&
                          lastSyncResult.routes.skipped === 0
                        ? 'Already up-to-date with Konnect.'
                        : [
                            lastSyncResult.routes.created > 0 && `${lastSyncResult.routes.created} request(s) added`,
                            lastSyncResult.routes.updated > 0 && `${lastSyncResult.routes.updated} request(s) updated`,
                            lastSyncResult.routes.deleted > 0 && `${lastSyncResult.routes.deleted} request(s) deleted`,
                            lastSyncResult.routes.skipped > 0 && `${lastSyncResult.routes.skipped} route(s) skipped`,
                          ]
                            .filter(Boolean)
                            .join(', ') + '.'}
                  </p>
                  {lastSyncResult.success && lastSyncResult.skippedRoutes.length > 0 && (
                    <>
                      <button
                        className="mt-1 flex items-center gap-1 text-(--hl) hover:text-(--color-font)"
                        onClick={() => setShowSyncDetails(prev => !prev)}
                      >
                        <Icon icon={showSyncDetails ? 'chevron-down' : 'chevron-right'} className="h-2.5 w-2.5" />
                        {showSyncDetails ? 'Hide details' : 'Show details'}
                      </button>
                      {showSyncDetails && (
                        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                          {[...skippedRoutesByReason.entries()].map(([reason, routes]) => {
                            const MAX_SHOW = 5;
                            const visible = routes.slice(0, MAX_SHOW);
                            const extra = routes.length - MAX_SHOW;
                            return (
                              <div key={reason}>
                                <p className="text-(--hl)">{reason} for the following routes:</p>
                                <ul className="mt-1 space-y-0.5 pl-3">
                                  {visible.map(r => (
                                    <li key={r} className="list-disc text-(--color-font)">
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                                {extra > 0 && (
                                  <div className="mt-1 flex items-center gap-2 pl-3 text-(--hl)">
                                    <span>+ {extra} more</span>
                                    <button
                                      className="underline hover:text-(--color-font)"
                                      onClick={() => {
                                        navigator.clipboard.writeText(routes.join('\n'));
                                        setCopiedReason(reason);
                                        setTimeout(() => setCopiedReason(null), 2000);
                                      }}
                                    >
                                      {copiedReason === reason ? 'Copied' : 'Copy full list'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <button
                className="-mt-2 shrink-0 text-xl text-(--hl) hover:text-(--color-font)"
                onClick={() => setLastSyncResult(null)}
              >
                <Icon icon="close" />
              </button>
            </div>
          )}
        </>
      )}

      {showKonnectConfigModal && (
        <KonnectSettingsModal
          onClose={() => setShowKonnectConfigModal(false)}
          syncKonnectProjectsAndNotifyRef={syncKonnectProjectsAndNotifyRef}
        />
      )}
    </div>
  );
};

export const ProjectNavigationSidebar = forwardRef<ProjectNavigationSidebarHandle, ProjectNavigationSidebarProps>(
  ProjectNavigationSidebarInner,
);

export const EmptyProjectNavigationSidebar = ({ onCreateProject }: { onCreateProject: () => void }) => {
  const { organizationId } = useParams() as { organizationId: string };
  const isScratchPad = models.organization.isScratchpadOrganizationId(organizationId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="global-navigation-sidebar">
      <Tabs>
        <SideBarTabList
          konnectSyncEnabled={false}
          isScratchPad={isScratchPad}
          nonKonnectProjectLength={0}
          konnectProjectsLength={0}
        />
      </Tabs>
      <div className="flex justify-between gap-1 p-(--padding-sm)">
        <SidebarSearchField value="" isDisabled onChange={() => {}} />
        {!isScratchPad && <NewProjectButton onPress={onCreateProject} />}
      </div>
    </div>
  );
};
