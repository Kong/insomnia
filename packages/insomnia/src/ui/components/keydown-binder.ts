import { useEffect } from 'react';
import {
  createKeybindingsHandler as _createKeybindingsHandler,
  type KeyBindingHandlerOptions,
  type KeyBindingMap,
  tinykeys,
} from 'tinykeys';

import type { KeyboardShortcut, KeyCombination } from '~/insomnia-data/common';
import { getPlatformKeyCombinations, keyboardKeys } from '~/insomnia-data/common';
import { useRootLoaderData } from '~/root';

const keyCombinationToTinyKeyString = ({ ctrl, alt, shift, meta, keyCode }: KeyCombination): string =>
  `${meta ? 'Meta+' : ''}${alt ? 'Alt+' : ''}${ctrl ? 'Control+' : ''}${shift ? 'Shift+' : ''}` +
  Object.entries(keyboardKeys).find(([, { keyCode: kc }]) => kc === keyCode)?.[1].code;

export function useKeyboardShortcuts(
  getTarget: () => HTMLElement | Window,
  listeners: Partial<Record<KeyboardShortcut, (event: KeyboardEvent) => any>>,
) {
  const { settings } = useRootLoaderData()!;
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
    const keyBindingMap: KeyBindingMap = Object.fromEntries(
      keyboardShortcuts
        .flatMap(([keyboardShortcut, action]) =>
          getPlatformKeyCombinations(hotKeyRegistry[keyboardShortcut]).map(combo => ({
            tinyKeyString: keyCombinationToTinyKeyString(combo),
            action,
          })),
        )
        .map(({ tinyKeyString, action }) => [tinyKeyString, action]),
    );

    const unsubscribe = tinykeys(target, keyBindingMap, {
      capture: true, // use capture phase to ensure hotkeys can be triggered to avoid being blocked by aria-components
    });
    return unsubscribe;
  }, [hotKeyRegistry, listeners, getTarget]);
}

export function useDocBodyKeyboardShortcuts(
  listeners: Partial<Record<KeyboardShortcut, (event: KeyboardEvent) => any>>,
) {
  useKeyboardShortcuts(() => window, listeners);
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
