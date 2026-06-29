import { services } from 'insomnia-data';
import { Breadcrumb, Breadcrumbs, Button } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, NavLink, redirect, useParams } from 'react-router';

import { Icon } from '~/basic-components/icon';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { Pane, PaneBody, PaneHeader } from '~/ui/components/panes/pane';
import { showResourceNotFoundToast } from '~/ui/components/toast-notification';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp';
import { useWorkspaceLoaderData } from './organization.$organizationId.project.$projectId.workspace.$workspaceId';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { projectId, workspaceId, organizationId } = params;

  const project = await services.project.get(projectId);
  if (!project) {
    showResourceNotFoundToast(`Project not found: ${projectId}`);
    throw redirect(href('/organization/:organizationId/project', { organizationId }));
  }

  const activeWorkspace = await services.workspace.getById(workspaceId);
  if (!activeWorkspace) {
    showResourceNotFoundToast(`MCP Client not found: ${workspaceId}`);
    throw redirect(href('/organization/:organizationId/project/:projectId', { organizationId, projectId }));
  }

  // MCP collection only have one request
  const activeRequest = await services.mcpRequest.getByParentId(workspaceId);
  if (!activeRequest) {
    // INS-1972 when no mcp request is found in the workspace, do nothing here
    return null;
  }
  // Redirect to the debug page of the only request in the MCP workspace
  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId', {
      organizationId,
      projectId,
      workspaceId,
      requestId: activeRequest._id,
    }),
  );
}

// This page is used for INS-1972 when no mcp request is found in the workspace
const McpWorkspace = () => {
  const { activeWorkspace } = useWorkspaceLoaderData()!;

  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  return (
    <PanelGroup
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel id="sidebar" className="sidebar theme--sidebar" maxSize={40} minSize={10} collapsible>
        <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
          <div className="flex flex-col items-start divide-y divide-solid divide-(--hl-md)">
            <div className={`flex w-full`}>
              <Breadcrumbs className="m-0 flex h-(--line-height-sm) w-full list-none items-center gap-2 px-(--padding-sm) font-bold">
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
                  <Button
                    aria-label="Workspace actions"
                    data-testid="workspace-context-dropdown"
                    className="flex h-7 flex-1 items-center justify-center gap-2 truncate rounded-xs px-3 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  >
                    <span className="truncate" title={activeWorkspace.name}>
                      {activeWorkspace.name}
                    </span>
                  </Button>
                </Breadcrumb>
              </Breadcrumbs>
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-between gap-1 p-(--padding-sm)" />
          </div>
          <WorkspaceSyncDropdown />
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />

      <Panel className="flex flex-col">
        <Pane type="request">
          <PaneHeader />
          <PaneBody placeholder>
            <div className="pane__body--placeholder__cta text-center">
              <p className="font-bold">Your local version of this MCP Client contains errors and cannot be opened.</p>
              <p>Pull to see if there is a newer version on the Cloud, or create a new MCP Client.</p>
            </div>
          </PaneBody>
        </Pane>
      </Panel>
    </PanelGroup>
  );
};

export default McpWorkspace;
