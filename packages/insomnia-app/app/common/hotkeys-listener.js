// @flow
import type { HotKeyDefinition, KeyBindings, KeyCombination } from './hotkeys';
import { areSameKeyCombinations, getPlatformKeyCombinations } from './hotkeys';
import * as models from '../models';

function _pressedHotKey(e: KeyboardEvent, bindings: KeyBindings): boolean {
  const pressedKeyComb: KeyCombination = {
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
    keyCode: e.keyCode,
  };
  const keyCombList = getPlatformKeyCombinations(bindings);

  for (const keyComb of keyCombList) {
    if (areSameKeyCombinations(pressedKeyComb, keyComb)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether a hotkey has been pressed.
 * @param e the activated keyboard event.
 * @param definition the hotkey definition being checked.
 * @returns {Promise<boolean>}
 */
export async function pressedHotKey(
  e: KeyboardEvent,
  definition: HotKeyDefinition,
): Promise<boolean> {
  const settings = await models.settings.getOrCreate();
  return _pressedHotKey(e, settings.hotKeyRegistry[definition.id]);
}

/**
 * Call callback if the hotkey has been pressed.
 * @param e the activated keyboard event.
 * @param definition the hotkey definition being checked.
 * @param callback to be called if the hotkey has been activated.
 * @returns {Promise<void>}
 */
export async function executeHotKey(
  e: KeyboardEvent,
  definition: HotKeyDefinition,
  callback: Function,
): Promise<void> {
  const settings = await models.settings.getOrCreate();
  if (_pressedHotKey(e, settings.hotKeyRegistry[definition.id])) {
    callback();
  }
}
