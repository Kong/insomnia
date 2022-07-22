import { HotKeyRegistry, KeyCombination } from 'insomnia-common';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import {
  areKeyBindingsSameAsDefault,
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  HotKeyDefinition,
  hotKeyRefs,
  newDefaultKeyBindings,
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

const HOT_KEY_DEFS: HotKeyDefinition[] = Object.keys(hotKeyRefs).map(k => hotKeyRefs[k]);

export const Shortcuts: FC<Props> = ({ handleUpdateKeyBindings }) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  /**
   * Checks whether the given key combination already existed.
   * @param newKeyComb the key combination to be checked.
   * @returns {boolean} true if already existed.
   */
  const checkKeyCombinationDuplicate = useCallback((newKeyComb: KeyCombination) => {
    for (const hotKeyRefId in hotKeyRegistry) {
      if (!hotKeyRegistry.hasOwnProperty(hotKeyRefId)) {
        continue;
      }
      const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefId]);
      for (const keyComb of keyCombs) {
        if (areSameKeyCombinations(keyComb, newKeyComb)) {
          return true;
        }
      }
    }
    return false;
  }, [hotKeyRegistry]);

  /**
   * Registers a new key combination under a hot key.
   * @param hotKeyRefId the reference id of a hot key to be given the new key combination.
   * @param keyComb the new key combination.
   */
  const addKeyCombination = useCallback((hotKeyRefId: string, keyComb: KeyCombination) => {
    const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefId]);
    keyCombs.push(keyComb);
    handleUpdateKeyBindings(hotKeyRegistry);
  }, [handleUpdateKeyBindings, hotKeyRegistry]);

  const handleAddKeyCombination = useCallback((hotKeyRefId: string) => {
    showModal(
      AddKeyCombinationModal,
      hotKeyRefId,
      checkKeyCombinationDuplicate,
      addKeyCombination,
    );
  }, [addKeyCombination, checkKeyCombinationDuplicate]);

  const handleRemoveKeyCombination = useCallback(({ hotKeyRefId, keyComb }: { hotKeyRefId: string; keyComb: KeyCombination }) => {
    const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefId]);
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
  }, [handleUpdateKeyBindings, hotKeyRegistry]);

  const handleResetKeyBindings = useCallback((hotKeyRefId: string) => {
    hotKeyRegistry[hotKeyRefId] = newDefaultKeyBindings(hotKeyRefId);
    handleUpdateKeyBindings(hotKeyRegistry);
  }, [handleUpdateKeyBindings, hotKeyRegistry]);

  const handleResetAllKeyBindings = useCallback(() => {
    handleUpdateKeyBindings(newDefaultRegistry());
  }, [handleUpdateKeyBindings]);
  return (
    <div className="shortcuts">
      <div className="row-spaced margin-bottom-xs">
        <div>
          <PromptButton className="btn btn--clicky" onClick={handleResetAllKeyBindings}>
            Reset all
          </PromptButton>
        </div>
      </div>
      <table className="table--fancy">
        <tbody>
          {HOT_KEY_DEFS.map((def: HotKeyDefinition) => {
            const keyBindings = hotKeyRegistry[def.id];
            const keyCombinations = getPlatformKeyCombinations(keyBindings);
            const hasRemoveItems = keyCombinations.length > 0;
            const hasResetItems = !areKeyBindingsSameAsDefault(def.id, keyBindings);
            return (
              <tr key={def.id}>
                <td style={{ verticalAlign: 'middle' }}>{def.description}</td>
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
                    <DropdownItem value={def.id} onClick={handleAddKeyCombination}>
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
                            value={{
                              hotKeyRefId: def.id,
                              keyComb: keyComb,
                            }}
                            buttonClass={PromptButton}
                            onClick={handleRemoveKeyCombination}
                          >
                            <i className="fa fa-trash-o" /> {display}
                          </DropdownItem>
                        );
                      })
                    }

                    {hasResetItems && <DropdownDivider />}
                    {hasResetItems && (
                      <DropdownItem
                        value={def.id}
                        buttonClass={PromptButton}
                        onClick={handleResetKeyBindings}
                      >
                        <i className="fa fa-empty" /> Reset keyboard shortcuts
                      </DropdownItem>
                    )}
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
