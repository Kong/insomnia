import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  GridList,
  GridListItem,
  Input,
  SearchField,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { type ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { NavLink, useParams } from 'react-router';
import { useLocalStorage } from 'react-use';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import {
  getDefaultServerCapabilities,
  type McpServerData,
  METHOD_INITIALIZE,
  METHOD_LIST_PROMPTS,
  METHOD_LIST_RESOURCE_TEMPLATES,
  METHOD_LIST_RESOURCES,
  METHOD_LIST_TOOLS,
} from '~/common/mcp-utils';
import type { McpEvent, McpMessageEvent } from '~/main/network/mcp';
import type { McpRequest, McpServerPrimitiveTypes } from '~/models/mcp-request';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type McpRequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { McpActionsDropdown } from '~/ui/components/dropdowns/mcp-actions-dropdown';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { McpRequestPane } from '~/ui/components/mcp/mcp-request-pane';
import {
  type PrimitiveSubItem,
  type PrimitiveTypeItem,
  type PromptItem,
  type ResourceItem,
  type ResourceTemplateItem,
  type ToolItem,
} from '~/ui/components/mcp/types';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { RealtimeResponsePane } from '~/ui/components/websockets/realtime-response-pane';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useReadyState } from '~/ui/hooks/use-ready-state';

export const McpPane = () => {
  const requestData = useRequestLoaderData()!;
  const activeResponse = requestData.activeResponse;
  const { activeRequest } = requestData as McpRequestLoaderData;
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);
  const [filter, setFilter] = useLocalStorage<string>(`${workspaceId}:mcp-list-filter`);
  const { settings } = useRootLoaderData()!;
  const [mcpServerData, setMcpServerData] = useState<McpServerData | null>(null);
  const [collapsedPrimitives, setCollapsedPrimitives] = useState<McpServerPrimitiveTypes[]>([]);
  const [selectedPrimitiveItem, setSelectedPrimitiveItem] = useState<PrimitiveSubItem | null>(null);

  const getPrimitiveCollection = () => {
    const collection: (PrimitiveTypeItem | PrimitiveSubItem)[] = [];
    if (mcpServerData) {
      const { primitives } = mcpServerData;
      const { tools, resources, resourceTemplates, prompts } = primitives;
      if (tools.length > 0) {
        collection.push({
          type: 'tools',
          name: 'Tools',
          collapsed: collapsedPrimitives.includes('tools'),
          itemLevel: 0,
          hide: false,
        });
        const hide = collapsedPrimitives.includes('tools');
        collection.push(...(tools.map(t => ({ ...t, type: 'tools', itemLevel: 1, hide })) as ToolItem[]));
      }
      if (resources.length > 0 || resourceTemplates.length > 0) {
        collection.push({
          type: 'resources',
          name: 'Resources',
          collapsed: collapsedPrimitives.includes('resources'),
          itemLevel: 0,
          hide: false,
        });
        const hide = collapsedPrimitives.includes('resources');
        collection.push(...(resources.map(r => ({ ...r, type: 'resources', itemLevel: 1, hide })) as ResourceItem[]));
        collection.push(
          ...(resourceTemplates.map(rt => ({
            ...rt,
            type: 'resources',
            itemLevel: 1,
            hide,
          })) as ResourceTemplateItem[]),
        );
      }
      if (prompts.length > 0) {
        collection.push({
          type: 'prompts',
          name: 'Prompts',
          collapsed: collapsedPrimitives.includes('prompts'),
          itemLevel: 0,
          hide: false,
        });
        const hide = collapsedPrimitives.includes('prompts');
        collection.push(...(prompts.map(p => ({ ...p, type: 'prompts', itemLevel: 1, hide })) as PromptItem[]));
      }
    }
    return collection;
  };

  const getServerCapabilities = () => {
    const serverCapabilities = getDefaultServerCapabilities();
    if (mcpServerData) {
      const { tools, resources, prompts } = mcpServerData.serverCapabilities;
      if (tools) {
        serverCapabilities.tools.enabled = true;
        serverCapabilities.tools.listChanged = !!tools.listChanged;
      }
      if (resources) {
        serverCapabilities.resources.enabled = true;
        serverCapabilities.resources.listChanged = !!resources.listChanged;
        serverCapabilities.resources.subscribe = !!resources.subscribe;
      }
      if (prompts) {
        serverCapabilities.prompts.enabled = true;
        serverCapabilities.prompts.listChanged = !!prompts.listChanged;
      }
    }
    return serverCapabilities;
  };

  // TODO Support filter
  const visibleCollection = getPrimitiveCollection().filter(item => !item.hide);
  const serverCapabilities = getServerCapabilities();
  const allowSubscribeResources = serverCapabilities.resources.enabled && serverCapabilities.resources.subscribe;
  const enableNotification =
    serverCapabilities.tools.listChanged ||
    serverCapabilities.resources.listChanged ||
    serverCapabilities.prompts.listChanged;
  // TODO Use these variables to enable notification
  console.log(`enableNotification`, enableNotification);
  console.log(`allowSubscribeResources`, allowSubscribeResources);

  const requestId = activeRequest._id;
  const { activeEnvironment } = useWorkspaceLoaderData()!;
  const readyState = useReadyState({ requestId, protocol: 'mcp' });

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    getScrollElement: () => parentRef.current,
    count: visibleCollection.length,
    estimateSize: useCallback(() => 32, []),
    overscan: 20,
    getItemKey: index => {
      const item = visibleCollection[index];
      return `${item.itemLevel}::${item.type}::${item.name}`;
    },
  });

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

  useEffect(() => {
    const updateServerData = async () => {
      const findFirstMatchEventData = (mcpEvents: McpEvent[], method: string) => {
        const firstMatchEvent = mcpEvents.find(
          event => 'method' in event && event.method === method,
        ) as McpMessageEvent;
        if (firstMatchEvent) {
          return firstMatchEvent.data.result;
        }
        return undefined;
      };
      const activeResponseId = activeResponse?._id;
      if (activeResponseId) {
        const allEvents = await window.main.mcp.event.findMany({ responseId: activeResponseId });
        const serverCapabilities =
          findFirstMatchEventData(allEvents, METHOD_INITIALIZE)?.capabilities || getDefaultServerCapabilities();
        const tools = findFirstMatchEventData(allEvents, METHOD_LIST_TOOLS)?.tools || [];
        const resources = findFirstMatchEventData(allEvents, METHOD_LIST_RESOURCES)?.resources || [];
        const resourceTemplates =
          findFirstMatchEventData(allEvents, METHOD_LIST_RESOURCE_TEMPLATES)?.resourceTemplates || [];
        const prompts = findFirstMatchEventData(allEvents, METHOD_LIST_PROMPTS)?.prompts || [];
        const mcpServerData = {
          serverCapabilities: serverCapabilities,
          primitives: {
            tools,
            resources,
            resourceTemplates,
            prompts,
          },
        } as McpServerData;
        setMcpServerData(mcpServerData);
      }
    };
    if (readyState) {
      // Get MCP server data when connection is ready
      updateServerData();
    }
  }, [readyState, activeResponse?._id]);

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
                    const newState = !allExpanded;
                    if (newState) {
                      setCollapsedPrimitives([]);
                    } else {
                      setCollapsedPrimitives(['tools', 'resources', 'prompts']);
                    }
                    setAllExpanded(newState);
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
              <GridList
                id="sidebar-mcp-gridlist"
                style={{ height: virtualizer.getTotalSize() }}
                items={virtualizer.getVirtualItems()}
                className="relative"
                aria-label="Mcp Server Capabilities"
                onAction={key => {
                  const id = key.toString();
                  if (id.startsWith('root_')) {
                    // Click on primitive type item
                    const primitiveType = id.split('root_')[1] as McpServerPrimitiveTypes;
                    setCollapsedPrimitives(prev => {
                      if (prev.includes(primitiveType)) {
                        return prev.filter(p => p !== primitiveType);
                      }
                      return [...prev, primitiveType];
                    });
                  } else {
                    // Click a specified primitive
                    const [type, name] = id.split('_');
                    const item = visibleCollection.find(i => i.itemLevel === 1 && i.type === type && i.name === name);
                    setSelectedPrimitiveItem(item as PrimitiveSubItem);
                  }
                }}
              >
                {virtualItem => {
                  const item = visibleCollection[virtualItem.index];
                  return (
                    <CollectionGridListItem
                      activeRequest={activeRequest}
                      item={item}
                      collapsedPrimitives={collapsedPrimitives}
                      style={{
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    />
                  );
                }}
              </GridList>
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
            <McpRequestPane
              selectedPrimitiveItem={
                selectedPrimitiveItem?.itemLevel === 1 ? (selectedPrimitiveItem as PrimitiveSubItem) : null
              }
              environment={activeEnvironment}
              readyState={readyState}
            />
          </Panel>
          <Panel id="mcp-response-pane" order={2} minSize={10} className="pane-two theme--pane">
            <ErrorBoundary showAlert>
              <RealtimeResponsePane />
            </ErrorBoundary>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

const CollectionGridListItem = ({
  activeRequest,
  style,
  item,
  collapsedPrimitives,
}: {
  activeRequest: McpRequest;
  item: PrimitiveTypeItem | PrimitiveSubItem;
  style: React.CSSProperties;
  collapsedPrimitives: McpServerPrimitiveTypes[];
}) => {
  const label = 'title' in item ? item.title : item.name;
  const uniqueId = item.itemLevel === 0 ? `root_${item.type}` : `${item.type}_${item.name}`;
  const itemLevel = item.itemLevel;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <GridListItem
      id={uniqueId}
      className={`group absolute left-0 top-0 w-full select-none outline-none ${item.itemLevel === 0 ? 'data-[drop-target]:bg-[--hl-md]' : 'border-solid data-[drop-target]:border-b data-[drop-target]:border-[--color-surprise]'}`}
      textValue={label}
      data-testid={`test-${uniqueId}`}
      style={style}
      ref={triggerRef}
    >
      <div
        onContextMenu={e => {
          e.preventDefault();
          setIsContextMenuOpen(true);
        }}
        className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden pl-4 pr-2 text-[--hl] outline-none transition-colors group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] data-[selected=true]:text-[--color-font]"
        style={{
          paddingLeft: `${itemLevel}em`,
        }}
      >
        <div className="relative flex h-[--line-height-xs] w-full select-none items-center gap-2 overflow-hidden px-4 text-[--hl] outline-none transition-colors">
          {itemLevel === 0 && (
            <Icon
              className="w-4 flex-shrink-0"
              icon={collapsedPrimitives.includes(item.type) ? 'caret-right' : 'caret-down'}
            />
          )}
          {item.type === 'tools' && item.itemLevel === 1 && (
            <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-success-rgb),0.5)] text-[0.65rem] text-[--color-font-success]">
              Tool
            </span>
          )}
          {item.type === 'resources' && item.itemLevel === 1 && (
            <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-surprise-rgb),0.5)] text-[0.65rem] text-[--color-font-surprise]">
              Res
            </span>
          )}
          {item.type === 'prompts' && item.itemLevel === 1 && (
            <span className="flex w-10 flex-shrink-0 items-center justify-center rounded-sm border border-solid border-[--hl-sm] bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-[--color-font-info]">
              Prompt
            </span>
          )}
          {label}
        </div>
        <McpActionsDropdown
          item={item}
          request={activeRequest}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
          triggerRef={triggerRef}
        />
      </div>
    </GridListItem>
  );
};

export default McpPane;
