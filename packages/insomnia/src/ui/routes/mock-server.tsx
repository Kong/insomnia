import React from 'react';
import { Breadcrumbs, Button, Item, Link } from 'react-aria-components';
import { LoaderFunction, NavLink, useFetcher, useParams } from 'react-router-dom';

import { invariant } from '../../utils/invariant';
import { WorkspaceDropdown } from '../components/dropdowns/workspace-dropdown';
import { Icon } from '../components/icon';
import { SidebarLayout } from '../components/sidebar-layout';

export const loader: LoaderFunction = async ({
  request,
  params,
}): Promise<{}> => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  return {};
};

const MockServerRoute = () => {
  const { organizationId, projectId, workspaceId, requestId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
  };
  const fetcher = useFetcher();

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
                  name: 'New Request Bin',
                },
                {
                  method: 'post',
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/request-bin/new`,
                }
              );
            }}
          >
            <Icon icon="plus" />
            New request bin
          </Button>
        </div>
      </div>}

    renderPaneOne={<div>Mock Server</div>}
    renderPaneTwo={<div>Mock Server</div>}
  />;
};

export default MockServerRoute;
