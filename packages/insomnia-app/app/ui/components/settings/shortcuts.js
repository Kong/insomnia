// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Hotkey from '../hotkey';
import type { HotKeyDefinition, HotKeyRegistry, KeyCombination } from '../../../common/hotkeys';
import {
  areKeyBindingsSameAsDefault,
  areSameKeyCombinations,
  constructKeyCombinationDisplay,
  getPlatformKeyCombinations,
  hotKeyRefs,
  newDefaultKeyBindings,
  newDefaultRegistry,
} from '../../../common/hotkeys';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showModal } from '../modals';
import AddKeyCombinationModal from '../modals/add-key-combination-modal';
import PromptButton from '../base/prompt-button';

type Props = {
  hotKeyRegistry: HotKeyRegistry,
  handleUpdateKeyBindings: Function,
};

const HOT_KEY_DEFS: Array<HotKeyDefinition> = [
  hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
  hotKeyRefs.REQUEST_QUICK_SWITCH,
  hotKeyRefs.REQUEST_SEND,
  hotKeyRefs.REQUEST_SHOW_OPTIONS,
  hotKeyRefs.REQUEST_SHOW_CREATE,
  hotKeyRefs.REQUEST_QUICK_CREATE,
  hotKeyRefs.REQUEST_SHOW_DELETE,
  hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER,
  hotKeyRefs.REQUEST_SHOW_DUPLICATE,
  hotKeyRefs.REQUEST_TOGGLE_PIN,
  hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR,
  hotKeyRefs.SHOW_COOKIES_EDITOR,
  hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
  hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU,
  hotKeyRefs.REQUEST_FOCUS_URL,
  hotKeyRefs.RESPONSE_FOCUS,
  hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU,
  hotKeyRefs.SIDEBAR_TOGGLE,
  hotKeyRefs.SIDEBAR_FOCUS_FILTER,
  hotKeyRefs.REQUEST_TOGGLE_HISTORY,
  hotKeyRefs.SHOW_AUTOCOMPLETE,
  hotKeyRefs.PREFERENCES_SHOW_GENERAL,
  hotKeyRefs.WORKSPACE_SHOW_SETTINGS,
  hotKeyRefs.REQUEST_SHOW_SETTINGS,
  hotKeyRefs.TOGGLE_MAIN_MENU,
  hotKeyRefs.PLUGIN_RELOAD,
  hotKeyRefs.ENVIRONMENT_UNCOVER_VARIABLES,
];

@autobind
class Shortcuts extends PureComponent<Props> {
  /**
   * Checks whether the given key combination already existed.
   * @param newKeyComb the key combination to be checked.
   * @returns {boolean} true if already existed.
   */
  checkKeyCombinationDuplicate(newKeyComb: KeyCombination): boolean {
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

  handleRemoveKeyCombination(toBeRemoved: Object) {
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
            {/* Dropdown items to remove key combinations. */
            keyCombinations.map((keyComb: KeyCombination) => {
              const display = constructKeyCombinationDisplay(keyComb, false);
              return (
                <DropdownItem
                  key={display}
                  value={{ hotKeyRefId: def.id, keyComb: keyComb }}
                  buttonClass={PromptButton}
                  onClick={this.handleRemoveKeyCombination}>
                  <i className="fa fa-trash-o" /> {display}
                </DropdownItem>
              );
            })}

            {hasResetItems && <DropdownDivider />}
            {hasResetItems && (
              <DropdownItem
                value={def.id}
                buttonClass={PromptButton}
                onClick={this.handleResetKeyBindings}>
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

export default Shortcuts;
