import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import {
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  keyboardShortcutDescriptions,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import { HotKeyRegistry, KeyboardShortcut, KeyCombination } from '../../../common/settings';
import * as models from '../../../models/index';
import { selectHotKeyRegistry, selectSettings } from '../../redux/selectors';
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
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const settings = useSelector(selectSettings);

  return (
    <div className="shortcuts">
      <div className="row-spaced margin-bottom-xs">
        <div>
          <PromptButton className="btn btn--clicky" onClick={() => models.settings.update(settings, { hotKeyRegistry: newDefaultRegistry() })}>
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
                    triggerButton={
                      <DropdownButton className="btn btn--clicky-small">
                        <i className="fa fa-gear" />
                      </DropdownButton>
                    }
                  >
                    <DropdownItem>
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
                                models.settings.update(settings, { hotKeyRegistry });
                              },
                            }
                          )}
                      />
                    </DropdownItem>
                    <DropdownSection title='Remove existing'>
                      {
                      /* Dropdown items to remove key combinations. */
                        keyCombosForThisPlatform.map((keyComb: KeyCombination) => {
                          const display = constructKeyCombinationDisplay(keyComb, false);
                          return (
                            <DropdownItem key={display}>
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
                                    models.settings.update(settings, { hotKeyRegistry });
                                  }
                                }}
                              />
                            </DropdownItem>
                          );
                        })
                      }
                    </DropdownSection>

                    <DropdownSection>
                      <DropdownItem>
                        <ItemContent
                          icon="empty"
                          label="Reset keyboard shortcuts"
                          withPrompt
                          onClick={() => {
                            hotKeyRegistry[keyboardShortcut] = newDefaultRegistry()[keyboardShortcut];
                            models.settings.update(settings, { hotKeyRegistry });
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
