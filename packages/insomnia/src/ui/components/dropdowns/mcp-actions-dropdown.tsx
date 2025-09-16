import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';

import type { McpServerData } from '~/common/mcp-utils';

import type { PlatformKeyCombinations } from '../../../common/settings';
import type { McpRequest, McpServerPrimitiveTypes } from '../../../models/mcp-request';
import { Icon } from '../icon';
import type { PrimitiveTypeItem } from '../mcp/types';

interface Props {
  item: PrimitiveTypeItem;
  activeRequest: McpRequest;
  triggerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRefreshPrimitive: (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => void;
  onUpdatePrimitiveNextCursor: (newNextCursor: string, type: McpServerPrimitiveTypes) => void;
  onLoadMorePrimitive: (
    newData: McpServerData['primitives'][McpServerPrimitiveTypes],
    type: McpServerPrimitiveTypes,
  ) => void;
}
interface actionList {
  name: string;
  id: string;
  icon: IconName;
  items: {
    id: string;
    name: string;
    icon: IconName;
    hint?: PlatformKeyCombinations;
    action: () => void;
  }[];
}

export const McpActionsDropdown = ({
  item,
  activeRequest,
  isOpen,
  onOpenChange,
  onRefreshPrimitive,
  onUpdatePrimitiveNextCursor,
  onLoadMorePrimitive,
  triggerRef,
}: Props) => {
  const { type } = item;
  const { nextCursor } = item as PrimitiveTypeItem;
  // If there is a nextCursor, it means there are more items to load, so we only support load more
  const couldRefresh = !nextCursor;
  const updateMethod = couldRefresh ? onRefreshPrimitive : onLoadMorePrimitive;

  const requestId = activeRequest._id;

  const handleRefreshPrimitive = async () => {
    const params = {
      ...(nextCursor && { cursor: nextCursor }),
    };
    if (type === 'tools') {
      const toolList = await window.main.mcp.primitive.listTools({ requestId, ...params });
      if (toolList) {
        updateMethod(toolList.tools, type);
        toolList.nextCursor && onUpdatePrimitiveNextCursor(toolList.nextCursor, type);
      }
    } else if (type === 'prompts') {
      const promptList = await window.main.mcp.primitive.listPrompts({ requestId, ...params });
      if (promptList) {
        updateMethod(promptList.prompts, type);
        promptList.nextCursor && onUpdatePrimitiveNextCursor(promptList.nextCursor, type);
      }
    } else if (type === 'resources') {
      const resourceList = await window.main.mcp.primitive.listResources({ requestId, ...params });
      if (resourceList) {
        updateMethod(resourceList.resources, type);
        resourceList.nextCursor && onUpdatePrimitiveNextCursor(resourceList.nextCursor, type);
      }
    }
  };

  const mcpPrimitiveActionList: actionList[] = [
    {
      name: 'Actions',
      id: 'actions',
      icon: 'cog',
      items: [
        {
          id: 'Refresh',
          name: 'Refresh',
          icon: 'refresh',
          action: handleRefreshPrimitive,
        },
      ],
    },
  ];

  return (
    <MenuTrigger
      isOpen={isOpen}
      onOpenChange={isOpen => {
        onOpenChange(isOpen);
      }}
    >
      <Button
        data-testid={`Dropdown-${item.type}`}
        aria-label="Mcp Actions"
        className="hidden aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] group-hover:flex group-focus:flex aria-pressed:bg-[--hl-sm]"
      >
        <Icon icon="caret-down" />
      </Button>
      <Popover
        className="flex min-w-max flex-col overflow-y-hidden"
        triggerRef={triggerRef}
        placement="bottom end"
        offset={5}
      >
        <Menu
          aria-label="Mcp Actions Menu"
          selectionMode="single"
          onAction={key =>
            mcpPrimitiveActionList
              .find(i => i.items.find(a => a.id === key))
              ?.items.find(a => a.id === key)
              ?.action()
          }
          items={mcpPrimitiveActionList}
          className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
        >
          {section => (
            <MenuSection className="flex flex-1 flex-col">
              <Header className="flex items-center gap-2 py-1 pl-2 text-xs uppercase text-[--hl]">
                <Icon icon={section.icon} /> <span>{section.name}</span>
              </Header>
              <Collection items={section.items}>
                {item => {
                  const { id, name, icon } = item;
                  let itemName = name;
                  let itemIcon = icon;
                  if (id === 'Refresh') {
                    itemName = couldRefresh ? 'Refresh' : 'Load More';
                    itemIcon = couldRefresh ? 'refresh' : 'chevron-down';
                  }
                  return (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                      aria-label={itemName}
                    >
                      <Icon icon={itemIcon} />
                      <span>{itemName}</span>
                    </MenuItem>
                  );
                }}
              </Collection>
            </MenuSection>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
