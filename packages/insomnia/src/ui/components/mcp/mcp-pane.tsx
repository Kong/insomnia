import { useVirtualizer } from '@tanstack/react-virtual';
import cn from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fuzzyMatchAll } from '~/common/misc';
import type { McpEvent, McpMessageEvent } from '~/main/mcp/types';
import type { McpRequest, McpServerPrimitiveTypes } from '~/models/mcp-request';
import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type McpRequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { SegmentEvent, trackOnceDaily } from '~/ui/analytics';
import { McpActionsDropdown } from '~/ui/components/dropdowns/mcp-actions-dropdown';
import { WorkspaceDropdown } from '~/ui/components/dropdowns/workspace-dropdown';
import { WorkspaceSyncDropdown } from '~/ui/components/dropdowns/workspace-sync-dropdown';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { McpRequestPane, type RequestPaneTabs } from '~/ui/components/mcp/mcp-request-pane';
import {
  type PrimitiveSubItem,
  type PrimitiveTypeItem,
  type PromptItem,
  type ResourceItem,
  type ResourceTemplateItem,
  type ToolItem,
} from '~/ui/components/mcp/types';
import { MCPCertificatesModal } from '~/ui/components/modals/mcp-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { RealtimeResponsePane } from '~/ui/components/websockets/realtime-response-pane';
import { INSOMNIA_TAB_HEIGHT } from '~/ui/constant';
import { useMcpReadyState } from '~/ui/hooks/use-mcp-ready-state';
import { useRequestMetaPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

const emptyServerData: McpServerData = {
  serverCapabilities: getDefaultServerCapabilities(),
  primitives: { tools: [], resources: [], resourceTemplates: [], prompts: [] },
};

export const McpPane = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { activeRequest, activeResponse, activeRequestMeta } = useRequestLoaderData()! as McpRequestLoaderData;
  const sidebarPanelRef = useRef<ImperativePanelGroupHandle>(null);
  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);
  const [filter, setFilter] = useLocalStorage<string>(`${workspaceId}:mcp-list-filter`);
  const { settings } = useRootLoaderData()!;
  const [mcpServerData, setMcpServerData] = useState<McpServerData>(emptyServerData);
  const [collapsedPrimitives, setCollapsedPrimitives] = useState<McpServerPrimitiveTypes[]>([]);
  const [selectedPrimitiveItem, setSelectedPrimitiveItem] = useState<PrimitiveSubItem | null>(null);
  const [primitiveNextCursor, setPrimitiveNextCursor] = useState<Partial<Record<McpServerPrimitiveTypes, string>>>({});
  const requestMetaPatcher = useRequestMetaPatcher();
  const [requestPaneActiveTab, setRequestPaneActiveTab] = useState<RequestPaneTabs>('params');
  const patchRequest = useRequestPatcher();
  const requestId = activeRequest._id;
  const { activeEnvironment, caCertificate } = useWorkspaceLoaderData()!;
  const readyState = useMcpReadyState({ requestId });
  const parentRef = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(
    settings.forceVerticalLayout ? 'vertical' : 'horizontal',
  );

  const isConnected = readyState === 'connected';

  const subscribeResources = activeRequest.subscribeResources;

  const visibleCollection = useMemo(() => {
    const collection: (PrimitiveTypeItem | PrimitiveSubItem)[] = [];
    if (mcpServerData) {
      const { primitives } = mcpServerData;
      const tools = primitives.tools.filter(tool =>
        filter ? Boolean(fuzzyMatchAll(filter, [tool.name, tool.description || ''])?.indexes) : true,
      );
      const resources = primitives.resources.filter(res =>
        filter ? Boolean(fuzzyMatchAll(filter, [res.name, res.description || '', res.uri])?.indexes) : true,
      );
      const resourceTemplates = primitives.resourceTemplates.filter(rt =>
        filter ? Boolean(fuzzyMatchAll(filter, [rt.name, rt.description || '', rt.uriTemplate])?.indexes) : true,
      );
      const prompts = primitives.prompts.filter(prompt =>
        filter ? Boolean(fuzzyMatchAll(filter, [prompt.name, prompt.description || ''])?.indexes) : true,
      );
      // Add primitive type item
      if (tools.length > 0) {
        collection.push({
          type: 'tools',
          name: 'Tools',
          collapsed: collapsedPrimitives.includes('tools'),
          itemLevel: 0,
          hide: false,
          ...(primitiveNextCursor.tools && { nextCursor: primitiveNextCursor.tools }),
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
          ...(primitiveNextCursor.resources && { nextCursor: primitiveNextCursor.resources }),
        });
        const hide = collapsedPrimitives.includes('resources');
        collection.push(
          ...(resources.map(r => ({ ...r, type: 'resources', itemLevel: 1, hide })) as ResourceItem[]),
          ...(resourceTemplates.map(rt => ({
            ...rt,
            type: 'resourceTemplates',
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
          ...(primitiveNextCursor.prompts && { nextCursor: primitiveNextCursor.prompts }),
        });
        const hide = collapsedPrimitives.includes('prompts');
        collection.push(...(prompts.map(p => ({ ...p, type: 'prompts', itemLevel: 1, hide })) as PromptItem[]));
      }
    }
    return collection.filter(item => !item.hide);
  }, [
    collapsedPrimitives,
    filter,
    mcpServerData,
    primitiveNextCursor.prompts,
    primitiveNextCursor.resources,
    primitiveNextCursor.tools,
  ]);

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
  const serverCapabilities = getServerCapabilities();
  const allowSubscribeResources =
    isConnected && serverCapabilities.resources.enabled && serverCapabilities.resources.subscribe;

  const updatePrimitiveNextCursor = (newNextCursor: string, type: McpServerPrimitiveTypes) => {
    setPrimitiveNextCursor(prev => ({
      ...prev,
      [type]: newNextCursor,
    }));
  };

  const updatePrimitiveData = (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => {
    setMcpServerData(prev => ({
      serverCapabilities: prev['serverCapabilities'],
      primitives: {
        ...prev['primitives'],
        [type]: newData,
      },
    }));
  };

  const loadMorePrimitiveData = (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => {
    setMcpServerData(prev => ({
      serverCapabilities: prev['serverCapabilities'],
      primitives: {
        ...prev['primitives'],
        [type]: [...prev['primitives'][type], ...newData],
      },
    }));
  };

  const handleSubscribe = async (item: ResourceItem) => {
    const isSubscribed = subscribeResources.includes(item.name);
    if (isSubscribed) {
      try {
        await window.main.mcp.primitive.unsubscribeResource({ uri: item.uri, requestId: requestId });
        patchRequest(requestId, { subscribeResources: subscribeResources.filter(r => r !== item.name) });
      } catch (error) {
        console.error(`Failed to unsubscribe resource ${item.name}: ${error}`);
      }
    } else {
      try {
        await window.main.mcp.primitive.subscribeResource({ uri: item.uri, requestId: requestId });
        patchRequest(requestId, { subscribeResources: [...subscribeResources, item.name] });
      } catch (error) {
        console.error(`Failed to subscribe resource ${item.name}: ${error}`);
      }
    }
  };

  useEffect(() => {
    const [, type, name] = activeRequestMeta?.activeMcpPrimitive?.match(/^([^_]+)_(.+)$/) || [];
    const primitiveItem = visibleCollection.find(i => i.itemLevel === 1 && i.type === type && i.name === name);
    setSelectedPrimitiveItem(primitiveItem ? (primitiveItem as PrimitiveSubItem) : null);
  }, [activeRequest._id, activeRequestMeta?.activeMcpPrimitive, visibleCollection]);

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

  const toggleSidebar = () => {
    const layout = sidebarPanelRef.current?.getLayout();

    if (!layout) {
      return;
    }

    layout[0] = layout && layout[0] > 0 ? 0 : DEFAULT_SIDEBAR_SIZE;

    sidebarPanelRef.current?.setLayout(layout);
  };

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', toggleSidebar);
    return unsubscribe;
  }, []);

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
          event => 'method' in event && event.method === method && event.direction === 'INCOMING',
        ) as McpMessageEvent;
        if (firstMatchEvent) {
          return 'result' in firstMatchEvent.data ? firstMatchEvent.data.result : undefined;
        }
        return;
      };
      const activeResponseId = activeResponse?._id;
      if (activeResponseId) {
        const allEvents = await window.main.mcp.event.findMany({ responseId: activeResponseId });
        const allMessageEvents = allEvents.filter(
          event => 'method' in event && event.direction === 'INCOMING',
        ) as McpMessageEvent[];
        const serverCapabilities =
          findFirstMatchEventData(allEvents, METHOD_INITIALIZE)?.capabilities || getDefaultServerCapabilities();
        const latestToolListEvent = findFirstMatchEventData(allMessageEvents, METHOD_LIST_TOOLS);
        const latestResourceListEvent = findFirstMatchEventData(allMessageEvents, METHOD_LIST_RESOURCES);
        const latestResourceTemplateListEvent = findFirstMatchEventData(
          allMessageEvents,
          METHOD_LIST_RESOURCE_TEMPLATES,
        );
        const latestPromptListEvent = findFirstMatchEventData(allMessageEvents, METHOD_LIST_PROMPTS);
        const tools = latestToolListEvent?.tools || [];
        const resources = latestResourceListEvent?.resources || [];
        const resourceTemplates = latestResourceTemplateListEvent?.resourceTemplates || [];
        const prompts = latestPromptListEvent?.prompts || [];
        // Get nextCursor for each primitive type
        const toolsNextCursor = latestToolListEvent?.nextCursor as string | undefined;
        const resourcesNextCursor = latestResourceListEvent?.nextCursor as string | undefined;
        const promptsNextCursor = latestPromptListEvent?.nextCursor as string | undefined;
        const primitiveNextCursor = {
          ...(toolsNextCursor && { tools: toolsNextCursor }),
          ...(resourcesNextCursor && { resources: resourcesNextCursor }),
          ...(promptsNextCursor && { prompts: promptsNextCursor }),
        };
        setPrimitiveNextCursor(primitiveNextCursor);

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
    // Use readyState instead of a boolean value to make sure this effect runs when readyState is connecting or connected
    if (activeResponse?._id || readyState !== 'disconnected') {
      // Get MCP server data when active response changes or when connection is ready
      updateServerData();
    } else {
      // Clear MCP server data when no active response
      setMcpServerData(emptyServerData);
    }
  }, [activeResponse?._id, readyState]);

  useDocBodyKeyboardShortcuts({
    sidebar_toggle: toggleSidebar,
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
  });

  const caStatus =
    activeRequest.sslValidation === false
      ? 'warning'
      : caCertificate?.path && !caCertificate.disabled
        ? 'success'
        : 'default';

  return (
    <PanelGroup
      ref={sidebarPanelRef}
      autoSaveId="insomnia-sidebar"
      id="wrapper"
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel id="sidebar" className="sidebar theme--sidebar" maxSize={40} minSize={10} collapsible>
        <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
          <div className="flex flex-col items-start divide-y divide-solid divide-(--hl-md)">
            <div className={`flex w-full h-[${INSOMNIA_TAB_HEIGHT}px]`}>
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
                  <WorkspaceDropdown />
                </Breadcrumb>
              </Breadcrumbs>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 p-(--padding-sm)">
            <div className="flex items-center justify-between gap-2">
              <EnvironmentPicker
                isOpen={isEnvironmentPickerOpen}
                onOpenChange={setIsEnvironmentPickerOpen}
                onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
              />
            </div>
            <Button
              onPress={() => setCertificatesModalOpen(true)}
              className="flex max-w-full flex-1 items-center justify-center gap-2 truncate rounded-sm px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            >
              <Icon icon="file-contract" className="w-5 shrink-0" />
              <span className="inline-flex items-center gap-2 truncate">
                Manage Certificates
                {caStatus !== 'default' && (
                  <Icon
                    icon="circle"
                    className={`${
                      {
                        success: 'text-(--color-success)',
                        warning: 'text-(--color-warning)',
                      }[caStatus]
                    } h-2 w-2`}
                  />
                )}
              </span>
            </Button>
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex justify-between gap-1 p-(--padding-sm)">
              <SearchField
                aria-label="Server Capability filter"
                className="group relative flex-1"
                value={filter ?? ''}
                onChange={value => {
                  setFilter(value);
                  if (value) {
                    trackOnceDaily(SegmentEvent.mcpListFiltered);
                  }
                }}
              >
                <Input
                  placeholder="Filter"
                  className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                />
                <div className="absolute top-0 right-0 flex h-full items-center px-2">
                  <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
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
                    window.main.trackSegmentEvent({ event: SegmentEvent.mcpListExpandCollapseClicked });
                  }}
                  className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                >
                  {({ isSelected }) => (
                    <Icon
                      icon={isSelected ? 'down-left-and-up-right-to-center' : 'up-right-and-down-left-from-center'}
                    />
                  )}
                </ToggleButton>
                <Tooltip
                  offset={8}
                  className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
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
                    const [, type, name] = id.match(/^([^_]+)_(.+)$/) || [];
                    const item = visibleCollection.find(i => i.itemLevel === 1 && i.type === type && i.name === name);
                    requestMetaPatcher(requestId, { activeMcpPrimitive: id });
                    setSelectedPrimitiveItem(item as PrimitiveSubItem);
                    setRequestPaneActiveTab('params');
                  }
                }}
              >
                {virtualItem => {
                  const item = visibleCollection[virtualItem.index];
                  const isSelected =
                    selectedPrimitiveItem?.type === item.type && selectedPrimitiveItem?.name === item.name;
                  return (
                    <CollectionGridListItem
                      activeRequest={activeRequest}
                      item={item}
                      collapsedPrimitives={collapsedPrimitives}
                      onUpdatePrimitiveNextCursor={updatePrimitiveNextCursor}
                      onRefreshPrimitive={updatePrimitiveData}
                      onLoadMorePrimitive={loadMorePrimitiveData}
                      allowSubscribeResources={allowSubscribeResources}
                      subscribeResources={subscribeResources || []}
                      handleSubscribe={handleSubscribe}
                      style={{
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      isSelected={isSelected}
                    />
                  );
                }}
              </GridList>
            </div>
          </div>
          <WorkspaceSyncDropdown />

          {isEnvironmentModalOpen && <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />}
          {isCertificatesModalOpen && <MCPCertificatesModal onClose={() => setCertificatesModalOpen(false)} />}
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
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
              activeTab={requestPaneActiveTab}
              onTabChange={setRequestPaneActiveTab}
            />
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
          />
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

const CollectionGridListItem = (props: {
  activeRequest: McpRequest;
  item: PrimitiveTypeItem | PrimitiveSubItem;
  style: React.CSSProperties;
  collapsedPrimitives: McpServerPrimitiveTypes[];
  allowSubscribeResources: boolean;
  subscribeResources: string[];
  handleSubscribe: (item: ResourceItem) => void;
  onRefreshPrimitive: (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => void;
  onUpdatePrimitiveNextCursor: (newNextCursor: string, type: McpServerPrimitiveTypes) => void;
  onLoadMorePrimitive: (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => void;
  isSelected: boolean;
}) => {
  const {
    item,
    style,
    collapsedPrimitives,
    allowSubscribeResources,
    subscribeResources,
    handleSubscribe,
    isSelected,
    ...restProps
  } = props;
  const label = 'title' in item ? item.title : item.name;
  const uniqueId = item.itemLevel === 0 ? `root_${item.type}` : `${item.type}_${item.name}`;
  const itemLevel = item.itemLevel;
  const isRootTypeItem = itemLevel === 0;
  const isResourceTypeItem = item.type === 'resources' && itemLevel === 1;
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  return (
    <GridListItem
      id={uniqueId}
      className={cn(
        `group absolute top-0 left-0 w-full outline-hidden select-none ${item.itemLevel === 0 ? 'data-drop-target:bg-(--hl-md)' : 'border-solid data-drop-target:border-b data-drop-target:border-(--color-surprise)'}`,
        {
          'bg-(--hl-sm) text-(--color-font)': isSelected,
        },
      )}
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
        className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden pr-2 pl-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) data-[selected=true]:text-(--color-font)"
        style={{
          paddingLeft: `${itemLevel}em`,
        }}
      >
        <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none">
          {isRootTypeItem && (
            <Icon
              className="w-4 shrink-0"
              icon={collapsedPrimitives.includes(item.type) ? 'caret-right' : 'caret-down'}
            />
          )}
          {item.type === 'tools' && item.itemLevel === 1 && (
            <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-success-rgb),0.5)] text-[0.65rem] text-(--color-font-success)">
              Tool
            </span>
          )}
          {(item.type === 'resources' || item.type === 'resourceTemplates') && item.itemLevel === 1 && (
            <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-surprise-rgb),0.5)] text-[0.65rem] text-(--color-font-surprise)">
              Res
            </span>
          )}
          {item.type === 'prompts' && item.itemLevel === 1 && (
            <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
              Prompt
            </span>
          )}
          {label}
        </div>
        {isRootTypeItem && (
          <McpActionsDropdown
            item={item}
            isOpen={isContextMenuOpen}
            onOpenChange={setIsContextMenuOpen}
            triggerRef={triggerRef}
            {...restProps}
          />
        )}
        {isResourceTypeItem && allowSubscribeResources && (
          <Button
            data-testid={`Dropdown-${item.type}`}
            aria-label="Mcp Actions"
            className="h-6 items-center justify-center rounded-xs pr-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all"
            onPress={() => handleSubscribe(item as ResourceItem)}
          >
            {subscribeResources.includes(item.name) ? 'Unsubscribe' : 'Subscribe'}
          </Button>
        )}
      </div>
    </GridListItem>
  );
};
