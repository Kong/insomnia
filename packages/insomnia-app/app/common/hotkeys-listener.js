// @flow
import type { HotKeyDefinition, KeyBindings } from './hotkeys';
import { getPlatformKeyCombinations } from './hotkeys';
import * as models from '../models';

function _pressedHotKey(e: KeyboardEvent, bindings: KeyBindings): boolean {
  const isCtrlPressed = e.ctrlKey;
  const isAltPressed = e.altKey;
  const isShiftPressed = e.shiftKey;
  const isMetaPressed = e.metaKey;
  const keyCombList = getPlatformKeyCombinations(bindings);

  for (const keyComb of keyCombList) {
    const { ctrl, alt, shift, meta, keyCode } = keyComb;

    if ((ctrl && !isCtrlPressed) || (!ctrl && isCtrlPressed)) {
      continue;
    }

    if ((alt && !isAltPressed) || (!alt && isAltPressed)) {
      continue;
    }

    if ((shift && !isShiftPressed) || (!shift && isShiftPressed)) {
      continue;
    }

    if ((meta && !isMetaPressed) || (!meta && isMetaPressed)) {
      continue;
    }

    if (keyCode !== e.keyCode) {
      continue;
    }

    return true;
  }

  return false;
}

export async function pressedHotKey(
  e: KeyboardEvent,
  definition: HotKeyDefinition,
): Promise<boolean> {
  const settings = await models.settings.getOrCreate();
  return _pressedHotKey(e, settings.hotKeyRegistry[definition.id]);
}

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
