import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { KeyCombination } from 'insomnia-common';
import { useEffect } from 'react';
import { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import tinykeys, { type KeyBindingMap, createKeybindingsHandler } from 'tinykeys';

import { AUTOBIND_CFG, isMac } from '../../common/constants';
import { getPlatformKeyCombinations, hotKeyRefs, KeyboardShortcut } from '../../common/hotkeys';
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

export function useKeyboardShortcuts(target: HTMLElement, listeners: { [key in KeyboardShortcut]?: (event: KeyboardEvent) => any }) {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);

  useEffect(() => {
    const finalListeners: KeyBindingMap = {};
    Object.entries(listeners).map(([key, listener]) => {
      const keyDefinition = hotKeyRefs[key as KeyboardShortcut];
      const bindings = hotKeyRegistry[keyDefinition.id];

      const keyCombList = getPlatformKeyCombinations(bindings);

      for (const keyComb of keyCombList) {
        const parseKeyComb = (keyComb: KeyCombination) => {
          const { ctrl, alt, shift, meta, keyCode } = keyComb;

          // Get the key from the keyCode from the event
          const key = Object.keys(keyboardKeys).find(
            keyName => keyboardKeys[keyName].keyCode === keyCode,
          );

          return `${ctrl ? 'Control+' : ''}${alt ? 'Alt+' : ''}${shift ? 'Shift+' : ''}${meta ? 'Meta+' : ''}${key}`;
        };

        finalListeners[parseKeyComb(keyComb)] = listener;
      }
    });

    const unsubscribe = tinykeys(target, finalListeners);
    return unsubscribe;
  }, [hotKeyRegistry, listeners, target]);
}

export function useGlobalKeyboardShortcuts(listeners: { [key in KeyboardShortcut]?: (event: KeyboardEvent) => any }) {
  useKeyboardShortcuts(document.body, listeners);
}

export { createKeybindingsHandler };
