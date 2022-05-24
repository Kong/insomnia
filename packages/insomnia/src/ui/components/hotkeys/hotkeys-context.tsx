import { EventEmitter } from 'events';
import { KeyBindings } from 'insomnia-common';
import React, {
  createContext,
  FunctionComponent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { HotKeyDefinition } from '../../../common/hotkeys';
import { checkPressedKeyCombs } from '../../../common/hotkeys-listener';

export interface HotKeyCommand {
  hotkeyId: string;
}
interface UseHotKeysContext {
  $hotkeyChannel: EventEmitter;
  sendHotkeyCommand(hotkeyId: string, condition?: string): void;
  checkHotkeyPressed(keyEvent: KeyboardEvent, definitions: Record<string, HotKeyDefinition>): null | HotKeyDefinition;
}

const HOTKEY_EVENT_TAG = 'HOTKEY_EVENT_TAG';
const HotKeysContext = createContext<UseHotKeysContext>({} as UseHotKeysContext);
const HotKeysProvider: FunctionComponent<{ hotKeyRegistry: Record<string, KeyBindings>; children: ReactNode}> = ({ hotKeyRegistry, children }) => {
  const $hotkeyChannel = useMemo(() => new EventEmitter(), []);
  const sendHotkeyCommand = useCallback((hotkeyId: string) => {
    $hotkeyChannel.emit(HOTKEY_EVENT_TAG, { hotkeyId });
  }, [$hotkeyChannel]);

  const checkHotkeyPressed = useCallback((e: KeyboardEvent, definitions: Record<string, HotKeyDefinition>): null | HotKeyDefinition => {
    const pressed = Object.values(definitions).find(def => checkPressedKeyCombs(e, def, hotKeyRegistry));
    if (!pressed) {
      return null;
    }

    return pressed;
  }, [hotKeyRegistry]);

  return (
    <HotKeysContext.Provider
      value={{
        sendHotkeyCommand,
        checkHotkeyPressed,
        $hotkeyChannel,
      }}
    >
      {children}
    </HotKeysContext.Provider>
  );
};

function useHotKeysEffect(callback: (hotkeyId: string) => void, hotkeys: string[]): void {
  const { $hotkeyChannel } = useContext(HotKeysContext);
  const hotkeyIds = useMemo(() => new Set(hotkeys), [hotkeys]);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useEffect(() => {
    const handler = (e: HotKeyCommand) => {
      if (!hotkeyIds.has(e.hotkeyId)) {
        return;
      }

      callbackRef.current?.(e.hotkeyId);
    };

    $hotkeyChannel.on(HOTKEY_EVENT_TAG, handler);

    return () => {
      $hotkeyChannel.off(HOTKEY_EVENT_TAG, handler);
    };
  }, [$hotkeyChannel, callbackRef, hotkeyIds]);
}

function useHotKeyEffect(callback: () => void, hotkeyId: string): ReturnType<typeof useEffect> {
  const { $hotkeyChannel } = useContext(HotKeysContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useEffect(() => {
    const handler = (e: HotKeyCommand) => {
      if (e.hotkeyId !== hotkeyId) {
        return;
      }

      callbackRef.current?.();
    };

    $hotkeyChannel.on(HOTKEY_EVENT_TAG, handler);

    return () => {
      $hotkeyChannel.off(HOTKEY_EVENT_TAG, handler);
    };
  }, [$hotkeyChannel, callbackRef, hotkeyId]);
}

function useHotKey(): Pick<UseHotKeysContext, 'sendHotkeyCommand' | 'checkHotkeyPressed'> {
  const { sendHotkeyCommand, checkHotkeyPressed } = useContext(HotKeysContext);
  return { sendHotkeyCommand, checkHotkeyPressed };
}

export { HotKeysProvider, useHotKeysEffect, useHotKeyEffect, useHotKey };
