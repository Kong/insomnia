import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import {
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  keyboardShortcutDescriptions,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import { generateId } from '../../../common/misc';
import type { HotKeyRegistry, KeyboardShortcut, KeyCombination } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
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
            // smelly
            const keyCombosForThisPlatform = getPlatformKeyCombinations(platformCombinations)
              .map(k => ({ ...k, id: generateId('key') }));

            return (
              <tr key={keyboardShortcut}>
                <td style={{ verticalAlign: 'middle' }}>{keyboardShortcutDescriptions[keyboardShortcut]}</td>
                <td className="text-right">
                  {keyCombosForThisPlatform.map(keyComb => {
                    return (
                      <code key={keyComb.id} className="margin-left-sm" style={{ lineHeight: '1.25em' }}>
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
                      <Button >
                        <i className="fa fa-gear" />
                      </Button>
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
                                  const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]);
                                  keyCombs.forEach((existingKeyComb, index) => {
                                    if (areSameKeyCombinations(existingKeyComb, keyComb)) {
                                      toBeRemovedIndex = index;
                                    }
                                  });
                                  if (toBeRemovedIndex >= 0) {
                                    keyCombs.splice(toBeRemovedIndex, 1);

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
