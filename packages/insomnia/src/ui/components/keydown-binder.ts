import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { HotKeyRegistry, KeyCombination } from 'insomnia-common';
import { useEffect } from 'react';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import tinykeys, { type KeyBindingMap, createKeybindingsHandler } from 'tinykeys';

import { AUTOBIND_CFG, isMac } from '../../common/constants';
import { getPlatformKeyCombinations, HotKeyName, hotKeyRefs } from '../../common/hotkeys';
import { keyboardKeys } from '../../common/keyboard-keys';
import { selectHotKeyRegistry } from '../redux/selectors';

interface Props {
  children?: ReactNode;
  onKeydown?: (...args: any[]) => any;
  onKeyup?: (...args: any[]) => any;
  disabled?: boolean;
  scoped?: boolean;
  stopMetaPropagation?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class KeydownBinder extends PureComponent<Props> {
  _handleKeydown(event: KeyboardEvent) {
    const { stopMetaPropagation, onKeydown, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? event.metaKey : event.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      event.stopPropagation();
    }

    if (onKeydown) {
      onKeydown(event);
    }
  }

  _handleKeyup(event: KeyboardEvent) {
    const { stopMetaPropagation, onKeyup, disabled } = this.props;

    if (disabled) {
      return;
    }

    const isMeta = isMac() ? event.metaKey : event.ctrlKey;

    if (stopMetaPropagation && isMeta) {
      event.stopPropagation();
    }

    if (onKeyup) {
      onKeyup(event);
    }
  }

  componentDidMount() {
    if (this.props.scoped) {
      // TODO: unsound casting
      const el = ReactDOM.findDOMNode(this) as HTMLElement | null;
      el?.addEventListener('keydown', this._handleKeydown, { capture: true });
      el?.addEventListener('keyup', this._handleKeyup, { capture: true });
    } else {
      document.body && document.body.addEventListener('keydown', this._handleKeydown, { capture: true });
      document.body && document.body.addEventListener('keyup', this._handleKeyup, { capture: true });
    }
  }

  componentWillUnmount() {
    if (this.props.scoped) {
      // TODO: unsound casting
      const el = ReactDOM.findDOMNode(this) as HTMLElement | null;
      el?.removeEventListener('keydown', this._handleKeydown, { capture: true });
      el?.removeEventListener('keyup', this._handleKeyup, { capture: true });
    } else {
      document.body && document.body.removeEventListener('keydown', this._handleKeydown, { capture: true });
      document.body && document.body.removeEventListener('keyup', this._handleKeyup, { capture: true });
    }
  }

  render() {
    return this.props.children ?? null;
  }
}
const keyCombinationToTinyKeyString = ({ ctrl, alt, shift, meta, keyCode }: KeyCombination): string =>
  `${ctrl ? 'Control+' : ''}${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${meta ? 'Meta+' : ''}` + Object.keys(keyboardKeys).find(keyName => keyboardKeys[keyName].keyCode === keyCode);

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
