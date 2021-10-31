import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { HotKeyRegistry, KeyCombination } from 'insomnia-common';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
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
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { Hotkey } from '../hotkey';
import { showModal } from '../modals';
import { AddKeyCombinationModal } from '../modals/add-key-combination-modal';

interface Props {
  hotKeyRegistry: HotKeyRegistry;
  handleUpdateKeyBindings: (keyBindings: HotKeyRegistry) => void;
}

const HOT_KEY_DEFS: HotKeyDefinition[] = Object.keys(hotKeyRefs).map(k => hotKeyRefs[k]);

@autoBindMethodsForReact(AUTOBIND_CFG)
export class Shortcuts extends PureComponent<Props> {
  /**
   * Checks whether the given key combination already existed.
   * @param newKeyComb the key combination to be checked.
   * @returns {boolean} true if already existed.
   */
  checkKeyCombinationDuplicate(newKeyComb: KeyCombination) {
    const { hotKeyRegistry } = this.props;

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
  }

  /**
   * Registers a new key combination under a hot key.
   * @param hotKeyRefId the reference id of a hot key to be given the new key combination.
   * @param keyComb the new key combination.
   */
  addKeyCombination(hotKeyRefId: string, keyComb: KeyCombination) {
    const { hotKeyRegistry, handleUpdateKeyBindings } = this.props;
    const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefId]);
    keyCombs.push(keyComb);
    handleUpdateKeyBindings(hotKeyRegistry);
  }

  handleAddKeyCombination(hotKeyRefId: string) {
    showModal(
      AddKeyCombinationModal,
      hotKeyRefId,
      this.checkKeyCombinationDuplicate,
      this.addKeyCombination,
    );
  }

  handleRemoveKeyCombination(toBeRemoved: Record<string, any>) {
    const { hotKeyRefId, keyComb } = toBeRemoved;
    const { hotKeyRegistry, handleUpdateKeyBindings } = this.props;
    const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefId]);
    let toBeRemovedIndex = -1;
    keyCombs.forEach((existingKeyComb, idx) => {
      if (areSameKeyCombinations(existingKeyComb, keyComb)) {
        toBeRemovedIndex = idx;
      }
    });

    if (toBeRemovedIndex >= 0) {
      keyCombs.splice(toBeRemovedIndex, 1);
      handleUpdateKeyBindings(hotKeyRegistry);
    }
  }

  handleResetKeyBindings(hotKeyRefId: string) {
    const { hotKeyRegistry, handleUpdateKeyBindings } = this.props;
    hotKeyRegistry[hotKeyRefId] = newDefaultKeyBindings(hotKeyRefId);
    handleUpdateKeyBindings(hotKeyRegistry);
  }

  handleResetAllKeyBindings() {
    const { handleUpdateKeyBindings } = this.props;
    handleUpdateKeyBindings(newDefaultRegistry());
  }

  renderHotKey(def: HotKeyDefinition, i: number) {
    const keyBindings = this.props.hotKeyRegistry[def.id];
    const keyCombinations = getPlatformKeyCombinations(keyBindings);
    const hasRemoveItems = keyCombinations.length > 0;
    const hasResetItems = !areKeyBindingsSameAsDefault(def.id, keyBindings);
    return (
      <tr key={i}>
        <td>{def.description}</td>
        <td className="text-right">
          {keyCombinations.map((keyComb: KeyCombination, idx: number) => {
            return (
              <code key={idx} className="margin-left-sm">
                <Hotkey keyCombination={keyComb} />
              </code>
            );
          })}
        </td>
        <td className="text-right options">
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky-small">
              <i className="fa fa-gear" />
            </DropdownButton>
            <DropdownItem value={def.id} onClick={this.handleAddKeyCombination}>
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
                    onClick={this.handleRemoveKeyCombination}
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
                onClick={this.handleResetKeyBindings}
              >
                <i className="fa fa-empty" /> Reset keyboard shortcuts
              </DropdownItem>
            )}
          </Dropdown>
        </td>
      </tr>
    );
  }

  render() {
    return (
      <div className="shortcuts">
        <div className="row-spaced margin-bottom-xs">
          <div>
            <PromptButton className="btn btn--clicky" onClick={this.handleResetAllKeyBindings}>
              Reset all
            </PromptButton>
          </div>
        </div>
        <table className="table--fancy">
          <tbody>
            {HOT_KEY_DEFS.map((def: HotKeyDefinition, idx: number) => {
              return this.renderHotKey(def, idx);
            })}
          </tbody>
        </table>
      </div>
    );
  }
}
