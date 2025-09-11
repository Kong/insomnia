import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';

import type { PlatformKeyCombinations } from '../../../common/settings';
import type { McpRequest } from '../../../models/mcp-request';
import { Icon } from '../icon';
import type { PrimitiveSubItem, PrimitiveTypeItem } from '../mcp/types';

interface Props {
  item: PrimitiveTypeItem | PrimitiveSubItem;
  request: McpRequest;
  triggerRef: React.RefObject<HTMLDivElement>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const McpActionsDropdown = ({ item, request, isOpen, onOpenChange, triggerRef }: Props) => {
  const { itemLevel, type } = item;

  if (itemLevel !== 0) {
    // Only show for capability type item
    return null;
  }

  const requestId = request._id;

  const handleRefreshPrimitive = () => {
    if (type === 'tools') {
      window.main.mcp.primitive.listTools({ requestId });
    } else if (type === 'prompts') {
      window.main.mcp.primitive.listPrompts({ requestId });
    } else if (type === 'resources') {
      window.main.mcp.primitive.listResources({ requestId });
    }
  };

  const mcpPrimitiveActionList: {
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
  }[] = [
    {
      name: 'Actions',
      id: 'actions',
      icon: 'cog',
      items: [
        {
          id: 'Refresh',
          name: 'Refresh',
          action: handleRefreshPrimitive,
          icon: 'refresh',
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
                {item => (
                  <MenuItem
                    key={item.id}
                    id={item.id}
                    className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                    aria-label={item.name}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.name}</span>
                  </MenuItem>
                )}
              </Collection>
            </MenuSection>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
};
