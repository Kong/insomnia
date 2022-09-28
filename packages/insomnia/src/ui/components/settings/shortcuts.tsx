import { HotKeyRegistry, KeyboardShortcut, KeyCombination } from 'insomnia-common';
import React, { FC } from 'react';
import { useSelector } from 'react-redux';

import {
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  keyboardShortcutDescriptions,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import * as models from '../../../models/index';
import { selectHotKeyRegistry, selectSettings } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { Hotkey } from '../hotkey';
import { showModal } from '../modals';
import { AddKeyCombinationModal } from '../modals/add-key-combination-modal';

/**
   * Checks whether the given key combination already existed.
   * @param newKeyComb the key combination to be checked.
   * @returns {boolean} true if already existed.
   */
export const isKeyCombinationInRegistry = (pressedKeyComb: KeyCombination, hotKeyRegistry: Partial<HotKeyRegistry>) =>
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
                  <Dropdown outline>
                    <DropdownButton className="btn btn--clicky-small">
                      <i className="fa fa-gear" />
                    </DropdownButton>
                    <DropdownItem
                      onClick={() =>
                        showModal(
                          AddKeyCombinationModal,
                          {
                            keyboardShortcut,
                            checkKeyCombinationDuplicate: (pressed: KeyCombination) => isKeyCombinationInRegistry(pressed, hotKeyRegistry),
                            addKeyCombination:(keyboardShortcut: KeyboardShortcut, keyComb: KeyCombination) => {
                              const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]);
                              keyCombs.push(keyComb);
                              models.settings.update(settings, { hotKeyRegistry });
                            },
                          }
                        )}
                    >
                      <i className="fa fa-plus-circle" />
                      Add keyboard shortcut
                    </DropdownItem>

                    {keyCombosForThisPlatform.length && <DropdownDivider>Remove existing</DropdownDivider>}
                    {
                      /* Dropdown items to remove key combinations. */
                      keyCombosForThisPlatform.map((keyComb: KeyCombination) => {
                        const display = constructKeyCombinationDisplay(keyComb, false);
                        return (
                          <DropdownItem
                            key={display}
                            buttonClass={PromptButton}
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
                          >
                            <i className="fa fa-trash-o" /> {display}
                          </DropdownItem>
                        );
                      })
                    }

                    <DropdownDivider />
                    <DropdownItem
                      buttonClass={PromptButton}
                      onClick={() => {
                        hotKeyRegistry[keyboardShortcut] = newDefaultRegistry()[keyboardShortcut];
                        models.settings.update(settings, { hotKeyRegistry });
                      }}
                    >
                      <i className="fa fa-empty" /> Reset keyboard shortcuts
                    </DropdownItem>

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
