import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Suspense } from 'react';
import { Breadcrumbs, Button, GridList, Item, Link, Menu, MenuTrigger, Popover } from 'react-aria-components';
import { LoaderFunction, NavLink, Route, Routes, useFetcher, useLoaderData, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { invariant } from '../../utils/invariant';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { EditableInput } from '../components/editable-input';
import { Icon } from '../components/icon';
import { showModal, showPrompt } from '../components/modals';
import { AskModal } from '../components/modals/ask-modal';
import { SidebarLayout } from '../components/sidebar-layout';
import { MockRouteResponse, MockRouteRoute } from './mock-route';

interface LoaderData {
  mockRoutes: {
    _id: string;
    name: string;
  }[];
}
export const loader: LoaderFunction = async ({
  request,
  params,
}): Promise<LoaderData> => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  return {
    mockRoutes: [
      {
        _id: '1',
        name: '/pets/1',
      },
      {
        _id: '2',
        name: '/pets/2',
      },
    ],
  };
};

const MockServerRoute = () => {
  const { organizationId, projectId, workspaceId, mockRouteId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    mockRouteId: string;
  };
  const { mockRoutes } = useLoaderData() as LoaderData;
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const mockRouteActionList: {
    id: string;
    name: string;
    icon: IconName;
    action: (suiteId: string, suiteName: string) => void;
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
              name && fetcher.submit(
                { name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${id}/rename`,
                  method: 'POST',
                }
              );
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
            title: 'Delete suite',
            message: `Do you really want to delete "${name}"?`,
            yesText: 'Delete',
            noText: 'Cancel',
            onDone: async (isYes: boolean) => {
              if (isYes) {
                fetcher.submit(
                  {},
                  {
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
  return <SidebarLayout
    className="new-sidebar"
    renderPageSidebar={
      <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
        <div className="flex flex-col items-start gap-2 justify-between p-[--padding-sm]">
          <Breadcrumbs className='react-aria-Breadcrumbs pb-[--padding-sm] border-b border-solid border-[--hl-sm] font-bold w-full'>
            <Item className="react-aria-Item h-full outline-none data-[focused]:outline-none">
              <Link data-testid="project" className="px-1 py-1 aspect-square h-7 flex flex-shrink-0 outline-none data-[focused]:outline-none items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                <NavLink
                  to={`/organization/${organizationId}/project/${projectId}`}
                >
                  <Icon className='text-xs' icon="chevron-left" />
                </NavLink>
              </Link>
              <span aria-hidden role="separator" className='text-[--hl-lg] h-4 outline outline-1' />
            </Item>
            <Item className="react-aria-Item h-full outline-none data-[focused]:outline-none">
              <WorkspaceDropdown />
            </Item>
          </Breadcrumbs>
        </div>
        <div className="p-[--padding-sm]">
          <Button
            className="px-4 py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={() => {
              fetcher.submit(
                {
                  name: 'New Mock Route',
                },
                {
                  method: 'post',
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                }
              );
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
              <Item
                key={item._id}
                id={item._id}
                textValue={item.name}
                className="group outline-none select-none w-full"
              >
                <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]">
                  <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                  <EditableInput
                    value={item.name}
                    name="name"
                    ariaLabel="Test suite name"
                    onChange={name => {
                      name && fetcher.submit(
                        { name },
                        {
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/${item._id}/rename`,
                          method: 'POST',
                        }
                      );
                    }}
                  />
                  <span className="flex-1" />
                  <MenuTrigger>
                    <Button
                      aria-label="Project Actions"
                      className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square data-[pressed]:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover className="min-w-max">
                      <Menu
                        aria-label="Project Actions Menu"
                        selectionMode="single"
                        onAction={key => {
                          mockRouteActionList
                            .find(({ id }) => key === id)
                            ?.action(item._id, item.name);
                        }}
                        items={mockRouteActionList}
                        className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                      >
                        {item => (
                          <Item
                            key={item.id}
                            id={item.id}
                            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                            aria-label={item.name}
                          >
                            <Icon icon={item.icon} />
                            <span>{item.name}</span>
                          </Item>
                        )}
                      </Menu>
                    </Popover>
                  </MenuTrigger>
                </div>
              </Item>
            );
          }}
        </GridList>
      </div>}

    renderPaneOne={<Routes>
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
          <div className="p-[--padding-md]">No mock route selected</div>
        }
      />
    </Routes>}
    renderPaneTwo={<MockRouteResponse />}
  />;
};

export default MockServerRoute;