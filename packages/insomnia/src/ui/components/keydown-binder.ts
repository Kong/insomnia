import { HotKeyRegistry, KeyCombination } from 'insomnia-common';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import tinykeys, { type KeyBindingMap, createKeybindingsHandler } from 'tinykeys';

import { getPlatformKeyCombinations, HotKeyName, hotKeyRefs } from '../../common/hotkeys';
import { keyboardKeys } from '../../common/keyboard-keys';
import { selectHotKeyRegistry } from '../redux/selectors';

const keyCombinationToTinyKeyString = ({ ctrl, alt, shift, meta, keyCode }: KeyCombination): string =>
  `${ctrl ? 'Control+' : ''}${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${meta ? 'Meta+' : ''}` + Object.entries(keyboardKeys).find(([, { keyCode: kc }]) => kc === keyCode)?.[1].label;

const transformBehaviourIntoHotKeyVariations = (hotKeyRegistry: HotKeyRegistry, behaviour: HotKeyName): KeyCombination[] =>
  getPlatformKeyCombinations(hotKeyRegistry[hotKeyRefs[behaviour].id]);

export function useKeyboardShortcuts(target: HTMLElement, listeners: { [key in HotKeyName]?: (event: KeyboardEvent) => any }) {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);

  useEffect(() => {
    // behaviour: a screaming snake case key and a function which triggers an action
    // eg. `SHOW_AUTOCOMPLETE` and `onThis`
    const behaviours = Object.entries(listeners);
    // makes a copy of each listener for each hot key variation for a given behaviour
    // hot key variations are multiple hotkeys that can trigger the same behaviour
    // eg. Control+Space, Control+Shift+Space both could trigger SHOW_AUTOCOMPLETE
    const hotkeyVariationsByBehaviour = behaviours.map(([behaviour, action]) =>
      transformBehaviourIntoHotKeyVariations(hotKeyRegistry, behaviour as HotKeyName)
        .map(combo => ({ tinyKeyString: keyCombinationToTinyKeyString(combo), action })));
    // nested arrays to object
    const keyBindingMap: KeyBindingMap = hotkeyVariationsByBehaviour.flat()
      .reduce((acc, { tinyKeyString, action }) => ({ ...acc, [tinyKeyString]: action }), {});
    const unsubscribe = tinykeys(target, keyBindingMap);
    return unsubscribe;
  }, [hotKeyRegistry, listeners, target]);
}

export function useGlobalKeyboardShortcuts(listeners: { [key in HotKeyName]?: (event: KeyboardEvent) => any }) {
  useKeyboardShortcuts(document.body, listeners);
}

export { createKeybindingsHandler };
