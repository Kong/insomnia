import React, { FC } from 'react';

import {
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  keyboardShortcutDescriptions,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import { HotKeyRegistry, KeyboardShortcut, KeyCombination } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { PromptButton } from '../base/prompt-button';
import { Hotkey } from '../hotkey';
import { showModal } from '../modals';
import { AddKeyCombinationModal } from '../modals/add-key-combination-modal';

export const isKeyCombinationInRegistry = (pressedKeyComb: KeyCombination, hotKeyRegistry: Partial<HotKeyRegistry>): boolean =>
  !!Object.values(hotKeyRegistry).find(bindings =>
    getPlatformKeyCombinations(bindings)
      .find(keyComb => areSameKeyCombinations(pressedKeyComb, keyComb)));

export const Shortcuts: FC = () => {
  const {
    settings,
  } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  const patchSettings = useSettingsPatcher();

  return (
    <div className="shortcuts">
      <div className="row-spaced margin-bottom-xs">
        <div>
          <PromptButton className="btn btn--clicky" onClick={() => patchSettings({ hotKeyRegistry: newDefaultRegistry() })}>
            Reset all
          </PromptButton>
        </div>
      </div>
      <table className="table--fancy">
        <tbody>
          {Object.entries(hotKeyRegistry).map(([key, platformCombinations]) => {
            const keyboardShortcut = key as KeyboardShortcut;
            const keyCombosForThisPlatform = getPlatformKeyCombinations(platformCombinations);

            return (
              <tr key={keyboardShortcut}>
                <td style={{ verticalAlign: 'middle' }}>{keyboardShortcutDescriptions[keyboardShortcut]}</td>
                <td className="text-right">
                  {keyCombosForThisPlatform.map((keyComb: KeyCombination, index: number) => {
                    return (
                      <code key={index} className="margin-left-sm" style={{ lineHeight: '1.25em' }}>
                        <Hotkey keyCombination={keyComb} />
                      </code>
                    );
                  })}
                </td>
                <td className="text-right options" style={{ verticalAlign: 'middle' }}>
                  <Dropdown
                    aria-label='Select a mode'
                    closeOnSelect={false}
                    triggerButton={
                      <DropdownButton
                        removePaddings={false}
                        removeBorderRadius={false}
                        disableHoverBehavior={false}
                        radius="var(--radius-md)"
                        variant='outlined'
                      >
                        <i className="fa fa-gear" />
                      </DropdownButton>
                    }
                  >
                    <DropdownItem aria-label='Add keyboard shortcut'>
                      <ItemContent
                        icon="plus-circle"
                        label="Add keyboard shortcut"
                        onClick={() =>
                          showModal(
                            AddKeyCombinationModal,
                            {
                              keyboardShortcut,
                              checkKeyCombinationDuplicate: (pressed: KeyCombination) => isKeyCombinationInRegistry(pressed, hotKeyRegistry),
                              addKeyCombination: (keyboardShortcut: KeyboardShortcut, keyComb: KeyCombination) => {
                                const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]);
                                keyCombs.push(keyComb);
                                patchSettings({ hotKeyRegistry });
                              },
                            }
                          )}
                      />
                    </DropdownItem>
                    <DropdownSection
                      aria-label='Remove existing section'
                      title='Remove existing'
                    >
                      {
                      /* Dropdown items to remove key combinations. */
                        keyCombosForThisPlatform.map((keyComb: KeyCombination) => {
                          const display = constructKeyCombinationDisplay(keyComb, false);
                          return (
                            <DropdownItem
                              key={display}
                              aria-label={display}
                            >
                              <ItemContent
                                icon="trash-o"
                                label={display}
                                withPrompt
                                onClick={() => {
                                  let toBeRemovedIndex = -1;
                                  keyCombosForThisPlatform.forEach((existingKeyComb, index) => {
                                    if (areSameKeyCombinations(existingKeyComb, keyComb)) {
                                      toBeRemovedIndex = index;
                                    }
                                  });
                                  if (toBeRemovedIndex >= 0) {
                                    keyCombosForThisPlatform.splice(toBeRemovedIndex, 1);
                                    patchSettings({ hotKeyRegistry });
                                  }
                                }}
                              />
                            </DropdownItem>
                          );
                        })
                      }
                    </DropdownSection>

                    <DropdownSection aria-label='Reset keyboard shortcuts section'>
                      <DropdownItem aria-label='Reset keyboard shortcuts'>
                        <ItemContent
                          icon="empty"
                          label="Reset keyboard shortcuts"
                          withPrompt
                          onClick={() => {
                            hotKeyRegistry[keyboardShortcut] = newDefaultRegistry()[keyboardShortcut];
                            patchSettings({ hotKeyRegistry });
                          }}
                        />
                      </DropdownItem>
                    </DropdownSection>
                  </Dropdown>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
