import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import tinykeys, { createKeybindingsHandler as _createKeybindingsHandler, KeyBindingHandlerOptions, type KeyBindingMap } from 'tinykeys';

import { getPlatformKeyCombinations } from '../../common/hotkeys';
import { keyboardKeys } from '../../common/keyboard-keys';
import { KeyboardShortcut, KeyCombination } from '../../common/settings';
import { RootLoaderData } from '../routes/root';

const keyCombinationToTinyKeyString = ({ ctrl, alt, shift, meta, keyCode }: KeyCombination): string =>
  `${meta ? 'Meta+' : ''}${alt ? 'Alt+' : ''}${ctrl ? 'Control+' : ''}${shift ? 'Shift+' : ''}` + Object.entries(keyboardKeys).find(([, { keyCode: kc }]) => kc === keyCode)?.[1].code;

export function useKeyboardShortcuts(getTarget: () => HTMLElement, listeners: { [key in KeyboardShortcut]?: (event: KeyboardEvent) => any }) {
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  const { hotKeyRegistry } = settings;

  useEffect(() => {
    const target = getTarget();

    if (!target) {
      return;
    }
    // behaviour: a screaming snake case key and a function which triggers an action
    // eg. `SHOW_AUTOCOMPLETE` and `onThis`
    const keyboardShortcuts = Object.entries(listeners) as [KeyboardShortcut, (event: KeyboardEvent) => any][];
    // makes a copy of each listener for each hot key variation for a given behaviour
    // hot key variations are multiple hotkeys that can trigger the same behaviour
    // eg. Control+Space, Control+Shift+Space both could trigger SHOW_AUTOCOMPLETE
    const keyBindingMap: KeyBindingMap = keyboardShortcuts
      .map(([keyboardShortcut, action]) => getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut])
        .map(combo => ({ tinyKeyString: keyCombinationToTinyKeyString(combo), action })))
      .flat()
      .reduce((acc, { tinyKeyString, action }) => ({ ...acc, [tinyKeyString]: action }), {});

    const unsubscribe = tinykeys(target, keyBindingMap);
    return unsubscribe;
  }, [hotKeyRegistry, listeners, getTarget]);
}

export function useDocBodyKeyboardShortcuts(listeners: { [key in KeyboardShortcut]?: (event: KeyboardEvent) => any }) {
  useKeyboardShortcuts(() => document.body, listeners);
}

export function createKeybindingsHandler(
  keyBindingMap: KeyBindingMap,
  options: KeyBindingHandlerOptions = {},
): (event: KeyboardEvent | React.KeyboardEvent<Element>) => void {
  const handler = _createKeybindingsHandler(keyBindingMap, options);

  return event => {
    if (event instanceof KeyboardEvent) {
      handler(event);
    } else {
      handler(event.nativeEvent);
    }
  };
}
