import type { Key } from '@react-types/shared';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { Placement } from 'react-aria';
import { Dialog, DialogTrigger, Heading, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

import { Button } from './button';

export interface SelectPopoverItem {
  id: Key;
  label: string;
  textValue?: string;
  isDisabled?: boolean;
}

export interface SelectPopoverProps<T extends SelectPopoverItem> {
  ariaLabel: string;
  items: T[];
  selectedKey?: Key | null;
  onSelectionChange: (key: Key) => void;
  renderTrigger: (selectedItem: T | null) => ReactNode;
  renderItem?: (item: T, isSelected: boolean) => ReactNode;
  emptyState?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  isDisabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  placement?: Placement;
  offset?: number;
  triggerClassName?: string;
  popoverClassName?: string;
  dialogClassName?: string;
  listClassName?: string;
  itemClassName?: string;
}

export function SelectPopover<T extends SelectPopoverItem>({
  ariaLabel,
  items,
  selectedKey,
  onSelectionChange,
  renderTrigger,
  renderItem,
  emptyState,
  footer,
  title,
  isDisabled,
  isOpen: isOpenProp,
  onOpenChange,
  placement = 'bottom start',
  offset = 8,
  triggerClassName,
  popoverClassName,
  dialogClassName,
  listClassName,
  itemClassName,
}: SelectPopoverProps<T>) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = isOpenProp !== undefined;
  const isOpen = isControlled ? isOpenProp : internalIsOpen;

  const setOpen = (nextIsOpen: boolean) => {
    if (!isControlled) {
      setInternalIsOpen(nextIsOpen);
    }

    onOpenChange?.(nextIsOpen);
  };

  const selectedItem = useMemo(() => {
    if (selectedKey === null || selectedKey === undefined) {
      return null;
    }

    return items.find(item => String(item.id) === String(selectedKey)) ?? null;
  }, [items, selectedKey]);

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setOpen}>
      <Button
        aria-label={ariaLabel}
        isDisabled={isDisabled}
        size="sm"
        variant="text"
        className={twMerge('', triggerClassName)}
      >
        {renderTrigger(selectedItem)}
      </Button>
      <Popover
        className={twMerge('z-10! flex min-w-55 flex-col', popoverClassName)}
        placement={placement}
        offset={offset}
      >
        <Dialog
          className={twMerge(
            'flex max-h-[min(300px,60vh)] min-w-55 flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none focus:outline-hidden',
            dialogClassName,
          )}
        >
          {title ? (
            <Heading className="flex shrink-0 items-center px-4 py-4 pb-1 text-sm font-semibold text-(--hl)">
              {title}
            </Heading>
          ) : null}
          <ListBox
            aria-label={ariaLabel}
            items={[...items]}
            selectedKeys={selectedKey === null || selectedKey === undefined ? [] : [selectedKey]}
            selectionMode="single"
            onSelectionChange={keys => {
              if (keys === 'all' || !keys) {
                return;
              }

              const [nextKey] = keys.values();

              if (nextKey === undefined) {
                return;
              }

              onSelectionChange(nextKey);
              setOpen(false);
            }}
            renderEmptyState={() => (emptyState ? <div className="p-3 text-sm text-(--hl)">{emptyState}</div> : null)}
            className={twMerge(
              'flex min-h-0 flex-1 flex-col overflow-y-auto p-2 text-sm focus:outline-hidden data-empty:py-0',
              listClassName,
            )}
          >
            {item => (
              <ListBoxItem
                id={item.id}
                textValue={item.textValue ?? item.label}
                isDisabled={item.isDisabled}
                className={twMerge(
                  'flex min-h-8 w-full items-center gap-2 rounded-sm px-2 text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold',
                  itemClassName,
                )}
              >
                {({ isSelected }) => renderItem?.(item, isSelected) ?? <span className="truncate">{item.label}</span>}
              </ListBoxItem>
            )}
          </ListBox>
          {footer ? <div className="shrink-0 border-t border-solid border-(--hl-sm) p-2">{footer}</div> : null}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
