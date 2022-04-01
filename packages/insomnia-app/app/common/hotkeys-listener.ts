import { KeyBindings, KeyCombination } from 'insomnia-common';

import * as models from '../models';
import type { HotKeyDefinition } from './hotkeys';
import { areSameKeyCombinations, getPlatformKeyCombinations } from './hotkeys';

const _pressedHotKey = (event: KeyboardEvent, bindings: KeyBindings) => {
  const pressedKeyComb: KeyCombination = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    keyCode: event.keyCode,
  };
  const keyCombList = getPlatformKeyCombinations(bindings);

  for (const keyComb of keyCombList) {
    if (areSameKeyCombinations(pressedKeyComb, keyComb)) {
      return true;
    }
  }

  return false;
};

/**
 * Check whether a hotkey has been pressed.
 * @param event the activated keyboard event.
 * @param definition the hotkey definition being checked.
 */
export const pressedHotKey = async (
  event: KeyboardEvent,
  definition: HotKeyDefinition,
) => {
  const settings = await models.settings.getOrCreate();
  return _pressedHotKey(event, settings.hotKeyRegistry[definition.id]);
};

/**
 * Call callback if the hotkey has been pressed.
 * @param event the activated keyboard event.
 * @param definition the hotkey definition being checked.
 * @param callback to be called if the hotkey has been activated.
 */
export const executeHotKey = async <T extends Function>(
  event: KeyboardEvent,
  definition: HotKeyDefinition,
  callback: T,
) => {
  if (await pressedHotKey(event, definition)) {
    callback();
  }
};
