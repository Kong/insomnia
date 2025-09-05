import { useEffect, useRef, useState } from 'react';
import { Breadcrumb, Breadcrumbs } from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavLink, useParams } from 'react-router';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { useRootLoaderData } from '~/root';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { Icon } from '~/ui/components/icon';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';

const McpPage = () => {
  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);
  const { settings } = useRootLoaderData()!;

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

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
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
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-[1px] bg-[--hl-md]" />
      <Panel className="flex flex-col">
        <PanelGroup autoSaveId="insomnia-panels" id="insomnia-panels" direction={direction}>
          x
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default McpPage;
