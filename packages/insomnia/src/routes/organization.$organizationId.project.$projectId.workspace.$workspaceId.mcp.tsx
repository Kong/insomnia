import { useEffect, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  Input,
  SearchField,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavLink, redirect, useParams } from 'react-router';
import { useLocalStorage } from 'react-use';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import * as models from '~/models';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useMcpRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp.request.$requestId';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { McpRequestPane } from '~/ui/components/mcp/mcp-request-pane';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useReadyState } from '~/ui/hooks/use-ready-state';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.mcp';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  if (!params.requestId) {
    const { projectId, workspaceId, organizationId } = params;
    invariant(workspaceId, 'Workspace ID is required');
    invariant(projectId, 'Project ID is required');
    const activeWorkspace = await models.workspace.getById(workspaceId);
    invariant(activeWorkspace, 'Workspace not found');
    // Mcp collection only have one request
    const activeRequest = await models.mcpRequest.getByParentId(workspaceId);
    invariant(activeRequest, 'MCP Request not found');

    if (activeRequest) {
      return redirect(
        `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mcp/request/${activeRequest._id}`,
      );
    }
  }
  return null;
}

const McpPage = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { activeRequest } = useMcpRequestLoaderData()!;
  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [filter, setFilter] = useLocalStorage<string>(`${workspaceId}:mcp-list-filter`);
  const { settings } = useRootLoaderData()!;

  const requestId = activeRequest._id;
  const { activeEnvironment } = useWorkspaceLoaderData()!;
  const readyState = useReadyState({ requestId, protocol: 'mcp' });

  const parentRef = useRef<HTMLDivElement>(null);

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

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );

  useEffect(() => {
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

  return (
    <PanelGroup
      ref={sidebarPanelRef}
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-[--color-font]"
      direction="horizontal"
    >
      <Panel id="sidebar" className="sidebar theme--sidebar" maxSize={40} minSize={10} collapsible>
        <div className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-md] overflow-hidden">
          <div className="flex flex-col items-start divide-y divide-solid divide-[--hl-md]">
            <div className={`flex w-full h-[${INSOMNIA_TAB_HEIGHT}px]`}>
              <Breadcrumbs className="m-0 flex h-[--line-height-sm] w-full list-none items-center gap-2 px-[--padding-sm] font-bold">
                <Breadcrumb className="flex h-full select-none items-center gap-2 text-[--color-font] outline-none data-[focused]:outline-none">
                  <NavLink
                    data-testid="project"
                    className="flex aspect-square h-7 flex-shrink-0 items-center justify-center gap-2 rounded-sm px-1 py-1 text-sm text-[--color-font] outline-none ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] data-[focused]:outline-none"
                    to={`/organization/${organizationId}/project/${projectId}`}
                  >
                    <Icon className="text-xs" icon="chevron-left" />
                  </NavLink>
                  <span aria-hidden role="separator" className="h-4 text-[--hl-lg] outline outline-1" />
                </Breadcrumb>
                <Breadcrumb className="flex h-full select-none items-center gap-2 truncate text-[--color-font] outline-none data-[focused]:outline-none">
                  <WorkspaceDropdown />
                </Breadcrumb>
              </Breadcrumbs>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 p-[--padding-sm]">
            <div className="flex items-center justify-between gap-2">
              <EnvironmentPicker
                isOpen={isEnvironmentPickerOpen}
                onOpenChange={setIsEnvironmentPickerOpen}
                onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-between gap-1 p-[--padding-sm]">
              <SearchField
                aria-label="Server Capability filter"
                className="group relative flex-1"
                value={filter ?? ''}
                onChange={setFilter}
              >
                <Input
                  placeholder="Filter"
                  className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                />
                <div className="absolute right-0 top-0 flex h-full items-center px-2">
                  <Button className="flex aspect-square w-5 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] group-data-[empty]:hidden">
                    <Icon icon="close" />
                  </Button>
                </div>
              </SearchField>
              <TooltipTrigger>
                <ToggleButton
                  aria-label="Expand All/Collapse all"
                  defaultSelected={allExpanded}
                  onChange={() => {
                    setAllExpanded(!allExpanded);
                  }}
                  className="flex aspect-square h-full items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
                >
                  {({ isSelected }) => (
                    <Icon
                      icon={isSelected ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'}
                    />
                  )}
                </ToggleButton>
                <Tooltip
                  offset={8}
                  className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                >
                  <span>{allExpanded ? 'Collapse all' : 'Expand all'}</span>
                </Tooltip>
              </TooltipTrigger>
            </div>

            <div className="flex-1 overflow-y-auto" ref={parentRef}>
              <span>MCP Server List</span>
            </div>
          </div>
          {isEnvironmentModalOpen && <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />}
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-[1px] bg-[--hl-md]" />
      <Panel className="flex flex-col">
        <OrganizationTabList currentPage="mcp" />
        <PanelGroup autoSaveId="insomnia-panels" id="insomnia-panels" direction={direction}>
          <Panel id="mcp-request-pane" order={1} minSize={10} className="pane-one theme--pane">
            <McpRequestPane environment={activeEnvironment} readyState={readyState} />
          </Panel>
          <Panel id="mcp-response-pane" order={2} minSize={10} className="pane-two theme--pane">
            <ErrorBoundary showAlert>
              <div />
            </ErrorBoundary>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default McpPage;
