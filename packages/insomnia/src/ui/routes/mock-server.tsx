import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Breadcrumb, Breadcrumbs, Button, GridList, GridListItem, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { type LoaderFunction, NavLink, Route, Routes, useFetcher, useLoaderData, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { DEFAULT_SIDEBAR_SIZE } from '../../common/constants';
import * as models from '../../models';
import type { MockRoute } from '../../models/mock-route';
import { invariant } from '../../utils/invariant';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { EditableInput } from '../components/editable-input';
import { Icon } from '../components/icon';
import { useDocBodyKeyboardShortcuts } from '../components/keydown-binder';
import { showModal, showPrompt } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { EmptyStatePane } from '../components/panes/empty-state-pane';
import { SvgIcon } from '../components/svg-icon';
import { OrganizationTabList } from '../components/tabs/tab-list';
import { formatMethodName } from '../components/tags/method-tag';
import { INSOMNIA_TAB_HEIGHT } from '../constant';
import { useInsomniaTab } from '../hooks/use-insomnia-tab';
import { MockRouteResponse, MockRouteRoute, useMockRoutePatcher } from './mock-route';
import { useRootLoaderData } from './root';
import type { WorkspaceLoaderData } from './workspace';
export interface MockServerLoaderData {
  mockServerId: string;
  mockRoutes: MockRoute[];
}
export const loader: LoaderFunction = async ({ params }): Promise<MockServerLoaderData> => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  invariant(workspaceId, 'Workspace ID is required');

  const activeWorkspace = await models.workspace.getById(workspaceId);
  invariant(activeWorkspace, 'Workspace not found');
  const activeMockServer = await models.mockServer.getByParentId(workspaceId);
  invariant(activeMockServer, 'Mock Server not found');
  const mockRoutes = await models.mockRoute.findByParentId(activeMockServer._id);

  return {
    mockServerId: activeMockServer._id,
    mockRoutes,
  };
};

const MockServerRoute = () => {
  const { organizationId, projectId, workspaceId, mockRouteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    mockRouteId: string;
  };
  const { settings } = useRootLoaderData();
  const { mockServerId, mockRoutes } = useLoaderData() as MockServerLoaderData;

  const { activeProject, activeWorkspace } = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;

  const fetcher = useFetcher();
  const navigate = useNavigate();
  const patchMockRoute = useMockRoutePatcher();
  const mockRouteActionList: {
    id: string;
    name: string;
    icon: IconName;
    action: (id: string, name: string) => void;
  }[] = [
      {
        id: 'rename',
        name: 'Rename',
        icon: 'edit',
        action: id => {
          showPrompt({
            title: 'Rename mock route',
            defaultValue: mockRoutes.find(s => s._id === id)?.name,
            submitName: 'Rename',
            onComplete: name => {
              const hasRouteInServer = mockRoutes.filter(m => m._id !== id)
                .find(m => m.name === name && m.method.toUpperCase() === mockRoutes.find(m => m._id !== id)?.method.toUpperCase());
              if (hasRouteInServer) {
                showModal(AlertModal, {
                  title: 'Error',
                  message: `Path "${name}" and method must be unique. Please enter a different name.`,
                });
                return;
              };
              if (name[0] !== '/') {
                showModal(AlertModal, {
                  title: 'Error',
                  message: 'Path must begin with a /',
                });
                return;
              };
              name && patchMockRoute(id, { name });
            },
          });
        },
      },
      {
        id: 'delete-route',
        name: 'Delete mock route',
        icon: 'trash',
        action: (id, name) => {
          showModal(AskModal, {
            title: 'Delete route',
            message: `Do you really want to delete "${name}"?`,
            yesText: 'Delete',
            noText: 'Cancel',
            onDone: async (isYes: boolean) => {
              if (isYes) {
                fetcher.submit(
                  {
                    isSelected: mockRouteId === id,
                  },
                  {
                    encType: 'application/json',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${id}/delete`,
                    method: 'POST',
                  }
                );
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

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');
  useLayoutEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => { };
    } else {
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
    }
  }, [settings.forceVerticalLayout, direction]);

  useInsomniaTab({
    organizationId,
    projectId,
    workspaceId,
    activeWorkspace,
    activeProject,
    activeMockRoute: mockRoutes.find(s => s._id === mockRouteId),
  });

  return (
    <PanelGroup ref={sidebarPanelRef} autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel id="sidebar" className='sidebar theme--sidebar' defaultSize={DEFAULT_SIDEBAR_SIZE} maxSize={40} minSize={10} collapsible>
      <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
          <div className={`flex items-center gap-2 h-[${INSOMNIA_TAB_HEIGHT}px] px-[--padding-sm]`}>
          <Breadcrumbs className='flex list-none items-center m-0 p-0 gap-2 font-bold w-full'>
            <Breadcrumb className="flex select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
              <NavLink data-testid="project" className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm" to={`/organization/${organizationId}/project/${projectId}`}>
                <Icon className='text-xs' icon="chevron-left" />
              </NavLink>
              <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
            </Breadcrumb>
            <Breadcrumb className="flex truncate select-none items-center gap-2 text-[--color-font] h-full outline-none data-[focused]:outline-none">
              <WorkspaceDropdown />
            </Breadcrumb>
          </Breadcrumbs>
        </div>
        <div className="p-[--padding-sm]">
          <Button
            className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={() => {
              showPrompt({
                title: 'New mock route',
                defaultValue: '/',
                submitName: 'Create',
                placeholder: '/path/to/resource',
                onComplete: name => {
                  const hasRouteInServer = mockRoutes.find(m => m.name === name && m.method.toUpperCase() === 'GET');
                  if (hasRouteInServer) {
                    showModal(AlertModal, {
                      title: 'Error',
                      message: `Path "${name}" and must be unique. Please enter a different name.`,
                    });
                    return;
                  };
                  if (name[0] !== '/') {
                    showModal(AlertModal, {
                      title: 'Error',
                      message: 'Path must begin with a /',
                    });
                    return;
                  };
                  fetcher.submit(
                    {
                      name,
                      parentId: mockServerId,
                    },
                    {
                      encType: 'application/json',
                      method: 'post',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                    }
                  );
                },
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
          className="overflow-y-auto flex-1 data-[empty]:py-0 py-[--padding-sm]"
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
                className="group outline-none select-none w-full"
              >
                <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]">
                  <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                  <span
                    className={
                      `w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center
                            ${{
                        'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
                        'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
                        'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                        'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
                        'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
                        'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
                        'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
                      }[item.method] || 'text-[--color-font] bg-[--hl-md]'}`
                    }
                  >
                    {formatMethodName(item.method)}
                  </span>
                  <EditableInput
                    value={item.name}
                    name="name"
                    ariaLabel="Mock route name"
                    className='hover:!bg-transparent'
                    onSubmit={name => {
                      const hasRouteInServer = mockRoutes.filter(m => m._id !== item._id).find(m => m.name === name && m.method.toUpperCase() === item.method.toUpperCase());
                      if (hasRouteInServer) {
                        showModal(AlertModal, {
                          title: 'Error',
                          message: `Path "${name}" and method must be unique. Please enter a different name.`,
                        });
                        return;
                      };
                      if (name[0] !== '/') {
                        showModal(AlertModal, {
                          title: 'Error',
                          message: 'Path must begin with a /',
                        });
                        return;
                      };
                      name && fetcher.submit(
                        { name },
                        {
                          encType: 'application/json',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${item._id}/update`,
                          method: 'POST',
                        }
                      );
                    }}
                  />
                  <span className="flex-1" />
                  <MenuTrigger>
                    <Button
                      aria-label="Mock Route Actions"
                      className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover className="min-w-max overflow-y-hidden flex flex-col">
                      <Menu
                        aria-label="Mock Route Action Menu"
                        selectionMode="single"
                        onAction={key => {
                          mockRouteActionList
                            .find(({ id }) => key === id)
                            ?.action(item._id, item.name);
                        }}
                        items={mockRouteActionList}
                        className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                      >
                        {item => (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
      <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
      <Panel className='flex flex-col'>
        <OrganizationTabList />
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>
          <Panel id="pane-one" minSize={10} className='pane-one theme--pane'>
            <Routes>
      <Route
        path={'mock-route/:mockRouteId/*'}
        element={
          <Suspense>
            <MockRouteRoute />
          </Suspense>
        }
      />
      <Route
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
          <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
          <Panel id="pane-two" minSize={10} className='pane-two theme--pane'>
            <Routes>
      <Route
        path={'mock-route/:mockRouteId/*'}
        element={
          <Suspense>
            <MockRouteResponse />
          </Suspense>
        }
      />
      <Route
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
    </PanelGroup>
  );
};

export default MockServerRoute;
