import { useVirtualizer } from '@tanstack/react-virtual';
import type { StorageRules } from 'insomnia-api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, GridList, GridListItem, Input, SearchField } from 'react-aria-components';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import * as reactUse from 'react-use';

import { fuzzyMatchAll } from '~/common/misc';
import {
  getAllRemoteBackendProjectsByProjectId,
  getUnsyncedRemoteWorkspaces,
  type InsomniaFile,
} from '~/common/project';
import type { Workspace } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import type { SyncResult } from '~/konnect/sync';
import { useRootLoaderData } from '~/root';
import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';
import { SegmentEvent } from '~/ui/analytics';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { UnsyncedWorkspaceNode } from '~/ui/components/sidebar/project-navigation-sidebar/unsynced-workspace-node';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import uiEventBus, { CLOUD_SYNC_FILE_CHANGE } from '~/ui/event-bus';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useKonnectSync } from '~/ui/hooks/use-konnect-sync';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { isPrimaryClickModifier } from '~/ui/utils';

import { Icon } from '../../icon';
import {
  type AllRequestsAndMetaInWorkspace,
  filterCollection,
  flattenCollectionChildren,
  getAllRequestsAndMetaByWorkspace,
  getWorkspacesByProjectIds,
} from './project-navigation-sidebar-utils';
import { ProjectNode } from './project-node';
import { RequestNode } from './request-node';
import type { FlatItem } from './types';
import { useProjectNavigationSidebarNavigation } from './use-project-navigation-sidebar-navigation';
import { useSidebarDragAndDrop } from './use-sidebar-drag-and-drop';
import { WorkspaceNode } from './workspace-node';

interface ProjectNavigationSidebarProps {
  storageRules: StorageRules;
  activeNodeId?: string;
  konnectSyncEnabled: boolean;
}

function showSkippedRoutesModal(result: SyncResult | null) {
  if (!result?.success || !result.skippedRoutes.length) {
    return;
  }
  const byService = new Map<string, string[]>();
  for (const { serviceName, routeName, reason } of result.skippedRoutes) {
    const list = byService.get(serviceName) ?? [];
    list.push(`${routeName} — ${reason}`);
    byService.set(serviceName, list);
  }
  showModal(AlertModal, {
    title: 'Skipped Routes',
    message: (
      <div>
        <p>{result.skippedRoutes.length} route(s) were skipped because they cannot be represented in Insomnia:</p>
        {[...byService.entries()].map(([service, routes]) => (
          <div key={service} style={{ margin: '8px 0' }}>
            <strong>{service}</strong>
            <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
              {routes.map(r => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  });
}

export const ProjectNavigationSidebar = ({ storageRules, konnectSyncEnabled }: ProjectNavigationSidebarProps) => {
  const navigate = useNavigate();
  const { organizationId, projectId: activeProjectId } = useParams() as {
    organizationId: string;
    projectId?: string;
    workspaceId?: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const { userSession } = useRootLoaderData()!;
  const projectLoaderData = useProjectLoaderData()!;
  const { projects, projectsSyncStatusPromise } = projectLoaderData;
  const [checkAllProjectSyncStatus] = useLoaderDeferData<Record<string, boolean>>(
    projectsSyncStatusPromise,
    organizationId,
  );
  const { presence } = useInsomniaEventStreamContext();
  const [searchParams, _setSearchParams] = useSearchParams();
  const tabNavigate = useTabNavigate();

  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [unsyncedFilesByProjectId, setUnsyncedFilesByProjectId] = useState<Map<string, InsomniaFile[]>>(new Map());
  const [projectNavigationSidebarFilter, setProjectNavigationSidebarFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-navigation-sidebar-filter`,
    '',
  );

  useEffect(() => {
    if (projectNavigationSidebarFilter) {
      window.main.trackSegmentEvent({
        event: SegmentEvent.projectListFiltered,
      });
    }
  }, [projectNavigationSidebarFilter]);

  const [konnectFilter, setKonnectFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-navigation-konnect-filter`,
    '',
  );
  const [storedTab, setActiveTab] = reactUse.useLocalStorage<'projects' | 'konnect'>(
    `${organizationId}:sidebar-tab`,
    'projects',
  );
  const activeTab = !konnectSyncEnabled ? 'projects' : (storedTab ?? 'projects');
  const isProjectTabActive = activeTab === 'projects';
  const { syncing, progress, error: syncError, startSync, cancelSync } = useKonnectSync();

  const nonKonnectProjects = projects.filter(p => !p.konnectControlPlaneId);
  const konnectProjects = projects.filter(p => p.konnectControlPlaneId != null);

  const [filterInputValue, setFilterInputValue] = useState(projectNavigationSidebarFilter || '');
  // Debounce update filter
  reactUse.useDebounce(() => setProjectNavigationSidebarFilter(filterInputValue), 300, [filterInputValue]);
  const [expandedProjectAndWorkspaceIds, setExpandedProjectAndWorkspaceIds] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:nav-expanded-projects-and-workspaces`,
    [],
  );
  const [flatItems, setFlatItems] = useState<FlatItem[]>([]);
  // ref to cache queried workspaces by project id
  const cachedWorkspacesRef = useRef<Map<string, Workspace[]>>(new Map());
  // ref to cache queried collection children (request & requestGroups) data and meta by workspace id
  const cachedCollectionChildrenAndMetaRef = useRef<Map<string, AllRequestsAndMetaInWorkspace>>(new Map());
  // ref to track whether we are currently fetching unsynced files for cloud sync projects to avoid duplicate requests
  const isFetchingUnsyncedFilesRef = useRef(false);

  const isScratchPad = activeProjectId === models.project.SCRATCHPAD_PROJECT_ID;

  const projectsWithPresence = useMemo(
    () =>
      projects
        .filter(isProjectTabActive ? p => !p.konnectControlPlaneId : p => p.konnectControlPlaneId != null)
        .map(project => {
          const projectPresence = presence
            .filter(p => p.project === project.remoteId)
            .filter(p => p.acct !== userSession.accountId)
            .map(user => {
              return {
                key: user.acct,
                alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
                src: user.avatar,
              };
            });
          return {
            ...project,
            presence: projectPresence,
            hasUncommittedOrUnpushedChanges:
              checkAllProjectSyncStatus?.[project._id] ||
              project.gitRepository?.hasUncommittedChanges ||
              project.gitRepository?.hasUnpushedChanges,
          };
        }),
    [projects, isProjectTabActive, presence, checkAllProjectSyncStatus, userSession.accountId],
  );

  const cloudSyncProjects = useMemo(() => projects.filter(p => models.project.isRemoteProject(p)), [projects]);
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
    for (const projectId of cloudSyncProjectIds) {
      try {
        const targetProject = await services.project.getById(projectId);
        if (targetProject && 'remoteId' in targetProject && targetProject.remoteId) {
          const files = await getAllRemoteBackendProjectsByProjectId({
            teamProjectId: targetProject.remoteId,
            organizationId,
          });
          result.set(
            projectId,
            files.map(f => ({
              id: f.rootDocumentId,
              name: f.name,
              scope: 'unsynced',
              label: 'Unsynced',
              remoteId: f.id,
              created: 0,
              lastModifiedTimestamp: 0,
            })),
          );
        }
      } catch (error) {
        console.error(`Failed to fetch unsynced files for project ${projectId}`, error);
        result.set(projectId, []);
      } finally {
        isFetchingUnsyncedFilesRef.current = false;
      }
    }
    return setUnsyncedFilesByProjectId(result);
  }, [organizationId, cloudSyncProjectIdsKey]);

  const handleSync = async () => {
    if (!konnectSyncEnabled) {
      return;
    }

    const runAndNotify = async () => {
      const result = await startSync(organizationId);
      showSkippedRoutesModal(result);
    };

    const isResync = konnectProjects.length > 0;
    if (isResync) {
      showModal(AskModal, {
        title: 'Re-sync Konnect',
        message: (
          <div>
            <p>Re-syncing will make the following changes:</p>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>
                <strong>Reset</strong> — request method, URL, name, and Konnect-managed headers
              </li>
              <li>
                <strong>Delete</strong> — requests added manually or no longer in Konnect
              </li>
              <li>
                <strong>Preserve</strong> — body, auth, query params, scripts, description, and user-added headers
              </li>
            </ul>
            <p>This cannot be undone. Continue?</p>
          </div>
        ),
        yesText: 'Re-sync',
        noText: 'Cancel',
        color: 'warning',
        onDone: async (confirmed: boolean) => {
          if (confirmed) {
            await runAndNotify();
          }
        },
      });
    } else {
      await runAndNotify();
    }
  };

  useEffect(() => {
    getAllRemoteFilesByProjectId();
    const updateUnsyncedFiles = () => {
      getAllRemoteFilesByProjectId();
    };
    // Subscribe to changes in unsynced workspace files to keep the sidebar up to date.
    // The subscribe is triggered in insomnia-event-stream-context when cloud sync files is changed remotely
    return uiEventBus.on(CLOUD_SYNC_FILE_CHANGE, updateUnsyncedFiles);
  }, [getAllRemoteFilesByProjectId, organizationId]);

  useEffect(() => {
    // clear caches on any router data change to avoid showing stale data
    cachedWorkspacesRef.current.clear();
    cachedCollectionChildrenAndMetaRef.current.clear();
  }, [projectLoaderData]);

  useEffect(() => {
    const tryToGetWorkspacesFromCache = async (projectIds: string[]) => {
      const uncachedProjectIds = projectIds.filter(id => !cachedWorkspacesRef.current.has(id));
      if (uncachedProjectIds.length > 0) {
        const workspacesByProjectId = await getWorkspacesByProjectIds(uncachedProjectIds);
        for (const [projectId, workspaces] of workspacesByProjectId.entries()) {
          cachedWorkspacesRef.current.set(projectId, workspaces);
        }
      }
      return cachedWorkspacesRef.current;
    };
    const tryToGetCollectionChildrenAndMetaFromCache = async (workspaceIds: string[]) => {
      const uncachedWorkspaceIds = workspaceIds.filter(id => !cachedCollectionChildrenAndMetaRef.current.has(id));
      if (uncachedWorkspaceIds.length > 0) {
        const collectionChildAndMetaByWorkspaceId = await getAllRequestsAndMetaByWorkspace(uncachedWorkspaceIds);
        for (const [workspaceId, collectionChildrenAndMeta] of collectionChildAndMetaByWorkspaceId.entries()) {
          cachedCollectionChildrenAndMetaRef.current.set(workspaceId, collectionChildrenAndMeta);
        }
      }
      return cachedCollectionChildrenAndMetaRef.current;
    };

    const buildWorkspaceAndCollectionData = async () => {
      const items: FlatItem[] = [];
      // Array of project and collection workspace ids that should get data from db

      const projectIds = projectsWithPresence.map(p => p._id);
      const collectionWorkspaceIds: string[] = [];
      const workspacesByProject = await tryToGetWorkspacesFromCache(projectIds);
      projectIds.forEach(projectId => {
        const workspaces = workspacesByProject.get(projectId) || [];
        workspaces.forEach(wk => {
          if (
            wk.scope === 'collection' &&
            // Fetch collection children and meta if 1) the workspace is expanded or 2) there is an active filter
            (!!projectNavigationSidebarFilter || (expandedProjectAndWorkspaceIds || []).includes(wk._id))
          ) {
            collectionWorkspaceIds.push(wk._id);
          }
        });
      });
      const collectionChildrenAndMetaByWorkspaceId =
        await tryToGetCollectionChildrenAndMetaFromCache(collectionWorkspaceIds);
      for (const project of projectsWithPresence) {
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
        // TODO workspace sort
        const sortedWorkspaces = [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
        const unsyncedWorkspaces = models.project.isRemoteProject(project)
          ? getUnsyncedRemoteWorkspaces(unsyncedFilesByProjectId.get(projectId) || [], sortedWorkspaces)
          : [];

        for (const workspace of [...sortedWorkspaces, ...unsyncedWorkspaces]) {
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
                ? flattenCollectionChildren(workspaceId, shouldHideCollectionChildren, allRequestsAndMetaInWorkspace)
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
            });
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
        items.forEach(item => (item.collapsed = false));
      }

      setFlatItems(items);
    };
    buildWorkspaceAndCollectionData();
  }, [
    expandedProjectAndWorkspaceIds,
    isProjectTabActive,
    organizationId,
    projectNavigationSidebarFilter,
    projectsWithPresence,
    unsyncedFilesByProjectId,
  ]);

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
        setExpandedProjectAndWorkspaceIds(newExpandedIds);
      }
    },
    [expandedProjectAndWorkspaceIds, projectNavigationSidebarFilter, setExpandedProjectAndWorkspaceIds],
  );

  const toggleRequestGroups = useCallback(
    async (requestGroupIds: string[], workspace: Workspace, collapsed?: boolean) => {
      if (requestGroupIds.length === 0) {
        return;
      }

      if (projectNavigationSidebarFilter && collapsed === undefined) {
        return;
      }

      const requestGroupMetas = await Promise.all(
        requestGroupIds.map(requestGroupId => services.requestGroupMeta.getByParentId(requestGroupId)),
      );

      const nextStates = requestGroupIds.map((requestGroupId, index) => {
        const requestGroupMeta = requestGroupMetas[index];
        return {
          requestGroupId,
          collapsed: collapsed ?? (requestGroupMeta ? !requestGroupMeta.collapsed : false),
        };
      });

      await Promise.all(
        nextStates.map(({ requestGroupId, collapsed }) =>
          services.requestGroupMeta.updateOrCreateForParentId(requestGroupId, { collapsed }),
        ),
      );

      cachedCollectionChildrenAndMetaRef.current.forEach(workspaceData => {
        workspaceData.requestGroupMetas.forEach(requestGroupMeta => {
          const nextState = nextStates.find(({ requestGroupId }) => requestGroupId === requestGroupMeta.parentId);
          if (nextState) {
            requestGroupMeta.collapsed = nextState.collapsed;
          }
        });
      });

      setFlatItems(previousFlatItems =>
        nextStates.reduce((nextFlatItems, { requestGroupId, collapsed }) => {
          const toggledChildren: { id: string; parentIsCollapsed: boolean }[] = [];

          return nextFlatItems.map(item => {
            if (item.kind !== 'collectionChild') {
              return item;
            }

            const { children, doc } = item;
            // Find toggled request group and update collapsed state
            if (doc._id === requestGroupId) {
              // Add all children of the toggled request group to the array to update their hidden state
              toggledChildren.push(
                ...(children?.map(child => ({ id: child.doc._id, parentIsCollapsed: collapsed })) ?? []),
              );

              return {
                ...item,
                collapsed,
                hidden: false,
              };
            }

            const matchedToggledChild = toggledChildren.find(tc => tc.id === item.doc._id);
            if (matchedToggledChild) {
              const { parentIsCollapsed } = matchedToggledChild;
              if (models.requestGroup.isRequestGroupId(doc._id)) {
                // Add children of the toggled child request group to the array to update their hidden state
                const isToggledRequestGroupCollapsed =
                  parentIsCollapsed ||
                  cachedCollectionChildrenAndMetaRef.current
                    .get(workspace._id)
                    ?.requestGroupMetas.find(rgm => rgm.parentId === doc._id)?.collapsed ||
                  false;
                toggledChildren.push(
                  ...(item.children?.map(child => ({
                    id: child.doc._id,
                    parentIsCollapsed: isToggledRequestGroupCollapsed,
                  })) ?? []),
                );
              }

              return {
                ...item,
                hidden: parentIsCollapsed,
              };
            }

            return item;
          });
        }, previousFlatItems),
      );
    },
    [projectNavigationSidebarFilter],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const visibleFlatItems = useMemo(() => flatItems.filter(i => !i.hidden), [flatItems]);
  const virtualizer = useVirtualizer({
    getScrollElement: () => parentRef.current,
    count: visibleFlatItems.length,
    estimateSize: useCallback(() => 32, []),
    overscan: 10,
    getItemKey: index => visibleFlatItems[index].doc._id,
  });
  const sidebarDragAndDropHooks = useSidebarDragAndDrop({
    flatItems,
    organizationId,
    virtualizer,
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-solid border-b-(--hl-md)">
        {['projects', 'konnect'].map(tabName => (
          <button
            key={tabName}
            className={`border-b-2 border-solid px-4 py-2 text-xs uppercase ${activeTab === tabName ? 'border-(--color-surprise) text-(--color-font)' : 'border-b-transparent text-(--hl) hover:bg-(--hl-xs)'}`}
            onClick={() => setActiveTab(tabName as 'projects' | 'konnect')}
          >
            {tabName === 'projects' ? `Projects (${nonKonnectProjects.length})` : `Konnect (${konnectProjects.length})`}
          </button>
        ))}
      </div>
      <div className="flex justify-between gap-1 p-(--padding-sm)">
        <SearchField
          aria-label="Projects filter"
          className="group relative flex-1"
          value={isProjectTabActive ? filterInputValue : konnectFilter}
          isDisabled={projects.length === 0}
          onChange={isProjectTabActive ? setFilterInputValue : setKonnectFilter}
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
        {isProjectTabActive ? (
          !isScratchPad && (
            <Button
              aria-label="Create new Project"
              onPress={() => setIsNewProjectModalOpen(true)}
              isDisabled={projects.length === 0}
              className="flex h-full items-center justify-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            >
              <Icon icon="plus" className="h-2.5 w-2.5" />
              <span>New Project</span>
            </Button>
          )
        ) : syncing ? (
          <Button
            aria-label="Cancel sync"
            onPress={cancelSync}
            className="flex h-full items-center justify-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            Cancel
            <Icon icon="stop-circle" />
          </Button>
        ) : (
          <Button
            aria-label="Sync Konnect"
            onPress={handleSync}
            className="flex h-full items-center justify-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            Sync
            <Icon icon="refresh" />
          </Button>
        )}
      </div>

      {!isProjectTabActive && syncing && <p className="truncate px-4 pb-1 text-xs text-(--hl) italic">{progress}</p>}
      {!isProjectTabActive && syncError && <p className="px-4 pb-1 text-xs text-(--color-danger)">{syncError}</p>}

      <div ref={parentRef} className="group/tree flex-1 overflow-y-auto py-(--padding-sm)">
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
                key={virtualItem.key}
                id={item.doc._id}
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
                      !isScratchPad && window.main.trackSegmentEvent({ event: SegmentEvent.projectSwitched });
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
                  } else if (item.kind === 'collectionChild') {
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
                  <ProjectNode item={item} onToggle={toggleProjectOrWorkspace} storageRules={storageRules} />
                )}

                {item.kind === 'workspace' && <WorkspaceNode item={item} onToggle={toggleProjectOrWorkspace} />}

                {item.kind === 'collectionChild' && <RequestNode item={item} onToggleFolder={toggleRequestGroups} />}
                {item.kind === 'unsyncedWorkspace' && <UnsyncedWorkspaceNode item={item} />}
              </GridListItem>
            );
          }}
        </GridList>
      </div>

      {isNewProjectModalOpen && (
        <ProjectModal
          isOpen={isNewProjectModalOpen}
          onOpenChange={setIsNewProjectModalOpen}
          storageRules={storageRules}
        />
      )}
    </div>
  );
};
