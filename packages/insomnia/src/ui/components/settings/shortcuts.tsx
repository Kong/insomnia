import { HotKeyRegistry, KeyboardShortcut, KeyCombination } from 'insomnia-common';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import {
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  keyboardShortcutDefinitions,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { Hotkey } from '../hotkey';
import { showModal } from '../modals';
import { AddKeyCombinationModal } from '../modals/add-key-combination-modal';

interface Props {
  handleUpdateKeyBindings: (keyBindings: HotKeyRegistry) => void;
}

export const Shortcuts: FC<Props> = ({ handleUpdateKeyBindings }) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  /**
   * Checks whether the given key combination already existed.
   * @param newKeyComb the key combination to be checked.
   * @returns {boolean} true if already existed.
   */
  const checkKeyCombinationDuplicate = useCallback((pressedKeyComb: KeyCombination) => {
    const allKeyBindings = Object.values(hotKeyRegistry);
    const hasKeyBinding = !!allKeyBindings.find(bindings => {
      const keyCombList = getPlatformKeyCombinations(bindings);
      return keyCombList.find(keyComb => areSameKeyCombinations(pressedKeyComb, keyComb));
    });
    return hasKeyBinding;
  }, [hotKeyRegistry]);

  /**
   * Registers a new key combination under a hot key.
   * @param keyboardShortcut the database key to be assigned the new key combination.
   * @param keyComb the new key combination.
   */
  const addKeyCombination = useCallback((keyboardShortcut: KeyboardShortcut, keyComb: KeyCombination) => {
    const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]);
    keyCombs.push(keyComb);
    handleUpdateKeyBindings(hotKeyRegistry);
  }, [handleUpdateKeyBindings, hotKeyRegistry]);

  return (
    <div className="shortcuts">
      <div className="row-spaced margin-bottom-xs">
        <div>
          <PromptButton className="btn btn--clicky" onClick={() => handleUpdateKeyBindings(newDefaultRegistry())}>
            Reset all
          </PromptButton>
        </div>
      </div>
      <table className="table--fancy">
        <tbody>
          {Object.entries(hotKeyRegistry).map(([keyboardShortcut, platformCombinations]) => {
            const keyCombinations = getPlatformKeyCombinations(platformCombinations);
            const description = keyboardShortcutDefinitions[keyboardShortcut];
            const hasRemoveItems = keyCombinations.length > 0;

            return (
              <tr key={keyboardShortcut}>
                <td style={{ verticalAlign: 'middle' }}>{description}</td>
                <td className="text-right">
                  {keyCombinations.map((keyComb: KeyCombination, index: number) => {
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
                          keyboardShortcut,
                          checkKeyCombinationDuplicate,
                          addKeyCombination,
                        )}
                    >
                      <i className="fa fa-plus-circle" />
                      Add keyboard shortcut
                    </DropdownItem>

                    {hasRemoveItems && <DropdownDivider>Remove existing</DropdownDivider>}
                    {
                      /* Dropdown items to remove key combinations. */
                      keyCombinations.map((keyComb: KeyCombination) => {
                        const display = constructKeyCombinationDisplay(keyComb, false);
                        return (
                          <DropdownItem
                            key={display}
                            buttonClass={PromptButton}
                            onClick={() => {
                              const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]);
                              let toBeRemovedIndex = -1;
                              keyCombs.forEach((existingKeyComb, index) => {
                                if (areSameKeyCombinations(existingKeyComb, keyComb)) {
                                  toBeRemovedIndex = index;
                                }
                              });
                              if (toBeRemovedIndex >= 0) {
                                keyCombs.splice(toBeRemovedIndex, 1);
                                handleUpdateKeyBindings(hotKeyRegistry);
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
                      value={keyboardShortcut}
                      buttonClass={PromptButton}
                      onClick={() => {
                        hotKeyRegistry[hotKeyRefId] = JSON.parse(JSON.stringify(newDefaultRegistry()[hotKeyRefId]));
                        handleUpdateKeyBindings(hotKeyRegistry);
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
