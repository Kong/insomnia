import { constructKeyCombinationDisplay, getPlatformKeyCombinations } from 'insomnia-data/common';
import React, { memo } from 'react';
import { useState } from 'react';
import {
  Button,
  Collection,
  ComboBox,
  Dialog,
  DialogTrigger,
  Header,
  Input,
  Keyboard,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Modal,
  ModalOverlay,
  Popover,
  Text,
} from 'react-aria-components';

import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';
import { AvatarGroup } from '~/ui/components/avatar';
import { CommandPaletteDebugCombobox } from '~/ui/components/command-palette-debug';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { useCommandPaletteItems } from '~/ui/hooks/use-command-palette-items';
import { isPrimaryClickModifier } from '~/ui/utils';

export const CommandPalette = memo(function CommandPalette({ style = {} }: { style?: React.CSSProperties }) {
  const [isOpen, setIsOpen] = useState(false);
  // Temporary debug switch to isolate the react-aria ComboBox from the command-palette-freeze bug.
  const [isDebugCombobox, setIsDebugCombobox] = useState(false);
  const { settings } = useRootLoaderData()!;

  useDocBodyKeyboardShortcuts({
    request_quickSwitch: () => {
      setIsOpen(true);
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.quickSearchOpenedByKeyboard,
      });
    },
  });

  const requestSwitchKeyCombination = getPlatformKeyCombinations(settings.hotKeyRegistry.request_quickSwitch)[0];

  return (
    <div className="flex flex-1 shrink-0 items-center gap-1">
      <DialogTrigger
        onOpenChange={isOpen => {
          setIsOpen(isOpen);
          if (isOpen) {
            window.main.trackAnalyticsEvent({
              event: AnalyticsEvent.quickSearchOpenedByMouse,
            });
          }
        }}
        isOpen={isOpen}
      >
        <Button
          style={{ ...style }}
          data-testid="quick-search"
          className="flex h-[30.5px] flex-1 shrink-0 items-center justify-between gap-2 rounded-md bg-(--hl-xs) px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all ring-inset hover:bg-(--hl-xs) focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-sm)"
        >
          <div>
            <Icon icon="search" className="mr-2" />
            Search..
          </div>
          {requestSwitchKeyCombination && (
            <Keyboard className="inline-block items-center space-x-0.5 rounded-md bg-(--hl-xs) px-2 py-0.5 text-center font-sans text-sm font-normal text-(--hl) shadow-xs">
              {constructKeyCombinationDisplay(requestSwitchKeyCombination, false)}
            </Keyboard>
          )}
        </Button>
        <ModalOverlay
          isDismissable
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full justify-center bg-black/30 pt-20"
        >
          <Modal className="w-full max-w-3xl">
            <Dialog aria-label="Command palette dialog" className="outline-hidden">
              {({ close }) =>
                isDebugCombobox ? (
                  <CommandPaletteDebugCombobox close={close} />
                ) : (
                  <CommandPaletteCombobox close={close} />
                )
              }
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      {/* Temporary debug toggle to isolate the react-aria ComboBox from the command-palette-freeze bug. */}
      <Button
        data-testid="quick-search-debug-toggle"
        aria-pressed={isDebugCombobox}
        onPress={() => setIsDebugCombobox(v => !v)}
        aria-label={
          isDebugCombobox
            ? 'Using debug combobox (click to use default)'
            : 'Using default combobox (click to use debug version)'
        }
        className={`flex h-[30.5px] shrink-0 items-center justify-center rounded-md px-2 text-xs ring-1 ring-transparent transition-all ring-inset hover:bg-(--hl-xs) ${
          isDebugCombobox ? 'bg-(--color-warning) text-(--color-font-warning)' : 'bg-(--hl-xs) text-(--color-font)'
        }`}
      >
        <Icon icon="bug" />
      </Button>
    </div>
  );
});

const CommandPaletteCombobox = ({ close }: { close: () => void }) => {
  const {
    workspaceId,
    requestId,
    comboboxSections,
    isLoadingComboboxItems,
    inputValue,
    search,
    closeWithAbort,
    isPullingFile,
    pullingFile,
  } = useCommandPaletteItems({ close });

  return (
    <ComboBox
      aria-label="Quick switcher"
      className="group overflow-hidden"
      isDisabled={isPullingFile}
      autoFocus
      allowsCustomValue={false}
      menuTrigger="focus"
      shouldFocusWrap
      inputValue={inputValue}
      defaultFilter={() => true}
      allowsEmptyCollection
      onInputChange={search}
      // By default, Escape would just clear the input field. We need to press twice to close the dialog.
      onKeyDown={e => {
        if (e.key === 'Escape') {
          closeWithAbort();
        }
      }}
      onSelectionChange={itemId => {
        if (!itemId) {
          return;
        }

        const item = comboboxSections.flatMap(section => section.children).find(item => item.id === itemId);

        item?.action();
      }}
    >
      {({ isOpen }) => {
        return (
          <>
            <Label aria-label="Filter" className="group relative flex flex-1 items-center pt-0">
              {isPullingFile ? (
                <>
                  <Icon icon="spinner" className="absolute left-4 animate-spin text-(--color-font)" />
                  <div
                    slot="input"
                    className="w-full rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-3 pr-7 pl-10 text-(--color-font) transition-none group-data-open:rounded-b-none"
                  >
                    Pulling: {pullingFile?.name}
                  </div>
                </>
              ) : (
                <>
                  {isLoadingComboboxItems ? (
                    <Icon icon="spinner" className="absolute left-4 animate-spin text-(--color-font)" />
                  ) : (
                    <Icon icon="search" className="absolute left-4 text-(--color-font)" />
                  )}
                  <Input
                    slot="input"
                    placeholder="Search and switch between requests, collections and documents"
                    className="w-full rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-3 pr-7 pl-10 text-(--color-font) transition-none group-data-open:rounded-b-none"
                  />
                </>
              )}
            </Label>
            <Popover
              offset={0}
              className={`relative w-(--trigger-width) flex-1 overflow-y-auto rounded-b-md border bg-(--color-bg) text-(--color-font) outline-hidden ${isOpen ? 'border-solid' : ''} border-(--hl-sm)`}
            >
              <ListBox
                aria-label="Commands"
                className="relative flex-1 overflow-y-auto outline-hidden"
                items={comboboxSections}
              >
                {section => (
                  <ListBoxSection className="flex flex-1 flex-col">
                    <Header className="p-2 text-xs text-(--hl) uppercase select-none">{section.name}</Header>
                    <Collection items={section.children}>
                      {item => (
                        <ListBoxItem textValue={item.textValue} className="group outline-hidden select-none">
                          <div
                            className={`flex outline-hidden select-none ${item.id === workspaceId || item.id === requestId ? 'font-bold text-(--color-font)' : 'text-(--hl)'} relative h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 transition-colors group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font) group-data-focused:bg-(--hl-sm)`}
                            // Avoid ListBoxItem onSelect getting triggered and focus stealing by the button
                            onMouseDownCapture={e => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            onPointerDown={e => e.stopPropagation()}
                            onPointerUp={e => e.stopPropagation()}
                            onClick={e => {
                              item.action(isPrimaryClickModifier(e));
                            }}
                          >
                            {item.icon}
                            <Text className="shrink-0 truncate px-1" slot="label">
                              {item.name}
                            </Text>
                            {item.presence.length > 0 && (
                              <span className="w-[70px]">
                                <AvatarGroup size="small" maxAvatars={3} items={item.presence} />
                              </span>
                            )}
                            <Text className="flex-1 truncate px-1 text-sm text-(--hl-md)" slot="description">
                              {item.description}
                            </Text>
                            {item.openInNewTab && (
                              <button
                                aria-label="Open in New Tab"
                                className="shrink-0 rounded-sm bg-(--hl-xs) px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-sm)"
                                onClick={e => {
                                  e.stopPropagation();
                                  item.openInNewTab?.();
                                }}
                              >
                                Open In New Tab <Icon icon="external-link-alt" className="w-3" />
                              </button>
                            )}
                          </div>
                        </ListBoxItem>
                      )}
                    </Collection>
                  </ListBoxSection>
                )}
              </ListBox>
            </Popover>
          </>
        );
      }}
    </ComboBox>
  );
};
