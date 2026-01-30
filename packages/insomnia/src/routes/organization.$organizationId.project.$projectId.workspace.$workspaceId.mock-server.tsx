import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  GridList,
  GridListItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  href,
  NavLink,
  redirect,
  Route as RouteComponent,
  Routes,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import * as models from '~/models';
import type { MockRoute } from '~/models/mock-route';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useMockRouteDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.delete';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { MockRouteModal } from '~/ui/components/modals/mock-route-modal';
import { EmptyStatePane } from '~/ui/components/panes/empty-state-pane';
import { SvgIcon } from '~/ui/components/svg-icon';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { formatMethodName } from '~/ui/components/tags/method-tag';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useInsomniaTab } from '~/ui/hooks/use-insomnia-tab';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server';
import {
  MockRouteResponse,
  MockRouteRoute,
} from './organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

export interface MockServerLoaderData {
  mockServerId: string;
  mockRoutes: MockRoute[];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { workspaceId, projectId, organizationId } = params;

  const project = await models.project.getById(projectId);
  if (!project) {
    showResourceNotFoundToast(`Project not found: ${projectId}`);
    throw redirect(href('/organization/:organizationId/project', { organizationId }));
  }

  const activeWorkspace = await models.workspace.getById(workspaceId);
  if (!activeWorkspace) {
    showResourceNotFoundToast(`Workspace not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  const activeMockServer = await models.mockServer.getByParentId(workspaceId);
  if (!activeMockServer) {
    showResourceNotFoundToast(`Mock Server not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }
  const mockRoutes = await models.mockRoute.findByParentId(activeMockServer._id);

  return {
    mockServerId: activeMockServer._id,
    mockRoutes,
  };
}

export function useMockServerLoaderData() {
  return useRouteLoaderData<typeof clientLoader>(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server',
  );
}

const Component = () => {
  const { organizationId, projectId, workspaceId, mockRouteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    mockRouteId: string;
  };
  const { settings } = useRootLoaderData()!;
  const { mockServerId, mockRoutes } = useLoaderData() as MockServerLoaderData;

  const { activeProject, activeWorkspace } = useWorkspaceLoaderData()!;

  const deleteMockRouteFetcher = useMockRouteDeleteActionFetcher();
  const navigate = useNavigate();
  const mockRouteActionList: {
    id: string;
    name: string;
    icon: IconName;
    action: (id: string, name: string) => void;
  }[] = [
    {
      id: 'edit-route',
      name: 'Edit',
      icon: 'edit',
      action: id => {
        const currentRoute = mockRoutes.find(m => m._id === id);
        setMockRouteModalState({
          isOpen: true,
          title: 'Edit Mock Route',
          defaultPath: currentRoute?.name,
          defaultMethod: currentRoute?.method,
          mode: 'edit',
          mockRouteId: id,
          mockServerId: mockServerId,
        });
      },
    },
    {
      id: 'delete-route',
      name: 'Delete',
      icon: 'trash',
      action: (id, name) => {
        showModal(AskModal, {
          title: 'Delete Mock Route',
          message: `Do you really want to delete "${name}"?`,
          yesText: 'Delete',
          noText: 'Cancel',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              deleteMockRouteFetcher.submit({
                organizationId,
                projectId,
                workspaceId,
                mockRouteId: id,
                isSelected: mockRouteId === id,
              });
            }
          },
        });
      },
    },
  ];

  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);

  function toggleSidebar() {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    layout[0] = layout && layout[0] > 0 ? 0 : DEFAULT_SIDEBAR_SIZE;

    sidebarPanelRef.current?.setLayout(layout);
  }

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);

    return unsubscribe;
  }, []);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
  });

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );

  const [mockRouteModalState, setMockRouteModalState] = useState<{
    isOpen: boolean;
    title: string;
    defaultPath?: string;
    defaultMethod?: string;
    mode: 'create' | 'edit';
    mockRouteId?: string;
    mockServerId?: string;
  } | null>(null);
  useLayoutEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => {};
    }
    // Listen on media query changes
    const mediaQuery = window.matchMedia('(max-width: 880px)');
    setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

    const handleChange = (e: MediaQueryListEvent) => {
      setDirection(e.matches ? 'vertical' : 'horizontal');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [settings.forceVerticalLayout, direction]);

  useInsomniaTab({
    organizationId,
    projectId,
    workspaceId,
    activeWorkspace,
    activeProject,
    activeMockRoute: mockRoutes.find(s => s._id === mockRouteId),
  });

  useEffect(() => {
    setMockRouteModalState(null);
  }, [mockRouteId]);

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
        className="sidebar theme--sidebar"
        defaultSize={DEFAULT_SIDEBAR_SIZE}
        maxSize={40}
        minSize={10}
        collapsible
      >
        <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
          <div className={`flex items-center gap-2 h-[${INSOMNIA_TAB_HEIGHT}px] px-(--padding-sm)`}>
            <Breadcrumbs className="m-0 flex w-full list-none items-center gap-2 p-0 font-bold">
              <Breadcrumb className="flex h-full items-center gap-2 text-(--color-font) outline-hidden select-none data-focused:outline-hidden">
                <NavLink
                  data-testid="project"
                  className="flex aspect-square h-7 shrink-0 items-center justify-center gap-2 rounded-xs px-1 py-1 text-sm text-(--color-font) ring-1 ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-focused:outline-hidden"
                  to={`/organization/${organizationId}/project/${projectId}`}
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
          <div className="p-(--padding-sm)">
            <Button
              className="flex items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              onPress={() => {
                setMockRouteModalState({
                  isOpen: true,
                  title: 'New Mock Route',
                  defaultPath: '/',
                  defaultMethod: 'GET',
                  mode: 'create',
                  mockServerId: mockServerId,
                });
              }}
            >
              <Icon icon="plus" />
              New Mock Route
            </Button>
          </div>
          <GridList
            aria-label="Mock Routes"
            items={mockRoutes.map(route => ({
              id: route._id,
              key: route._id,
              ...route,
            }))}
            className="flex-1 overflow-y-auto py-(--padding-sm) data-empty:py-0"
            disallowEmptySelection
            selectedKeys={[mockRouteId]}
            selectionMode="single"
            onSelectionChange={keys => {
              if (keys !== 'all') {
                const value = keys.values().next().value;
                navigate({
                  pathname: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${value}`,
                });
              }
            }}
          >
            {item => {
              return (
                <GridListItem
                  key={item._id}
                  id={item._id}
                  textValue={item.name}
                  className="group w-full outline-hidden select-none"
                >
                  <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                    <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
                    <span
                      className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
                        {
                          GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
                          POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
                          HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                          OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
                          DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
                          PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
                          PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
                        }[item.method] || 'bg-(--hl-md) text-(--color-font)'
                      }`}
                    >
                      {formatMethodName(item.method)}
                    </span>
                    <span className="flex-1 truncate">{item.name}</span>
                    <span className="flex-1" />
                    <MenuTrigger>
                      <Button
                        aria-label="Mock Route Actions"
                        className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset data-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                      >
                        <Icon icon="caret-down" />
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <Menu
                          aria-label="Mock Route Action Menu"
                          selectionMode="single"
                          onAction={key => {
                            mockRouteActionList.find(({ id }) => key === id)?.action(item._id, item.name);
                          }}
                          items={mockRouteActionList}
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
                  </div>
                </GridListItem>
              );
            }}
          </GridList>

          <WorkspaceSyncDropdown />
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
      <Panel className="flex flex-col">
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className="pane-one theme--pane">
            <Routes>
              <RouteComponent
                path={'mock-route/:mockRouteId/*'}
                element={
                  <Suspense>
                    <MockRouteRoute />
                  </Suspense>
                }
              />
              <RouteComponent
                path="*"
                element={
                  <EmptyStatePane
                    icon={<SvgIcon icon="bug" />}
                    documentationLinks={[]}
                    title="Create a route to configure mock response here"
                  />
                }
              />
            </Routes>
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
          />
          <Panel id="pane-two" minSize={10} className="pane-two theme--pane">
            <Routes>
              <RouteComponent
                path={'mock-route/:mockRouteId/*'}
                element={
                  <Suspense>
                    <MockRouteResponse />
                  </Suspense>
                }
              />
              <RouteComponent
                path="*"
                element={
                  <EmptyStatePane
                    icon={<SvgIcon icon="bug" />}
                    documentationLinks={[]}
                    title="Create a route to see mock server activity here"
                  />
                }
              />
            </Routes>
          </Panel>
        </PanelGroup>
      </Panel>
      {mockRouteModalState && (
        <MockRouteModal
          isOpen={mockRouteModalState.isOpen}
          onOpenChange={isOpen => {
            setMockRouteModalState(isOpen ? mockRouteModalState : null);
          }}
          title={mockRouteModalState.title}
          defaultPath={mockRouteModalState.defaultPath}
          defaultMethod={mockRouteModalState.defaultMethod}
          mode={mockRouteModalState.mode}
          mockRouteId={mockRouteModalState.mockRouteId}
          mockServerId={mockRouteModalState.mockServerId}
        />
      )}
    </PanelGroup>
  );
};

export default Component;
