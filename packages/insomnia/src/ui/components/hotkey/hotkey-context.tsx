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

import { checkPressedKeyCombs, HotKeyDefinition } from '../../../common';

export interface HotkeyCommand {
  hotkeyId: string;
}
interface UseHotkeyContext {
  $hotkeyChannel: EventEmitter;
  sendHotkeyCommand(hotkeyId: string, condition?: string): void;
  checkHotkeyPressed(keyEvent: KeyboardEvent, definitions: Record<string, HotKeyDefinition>): null | HotKeyDefinition;
}

const HOTKEY_EVENT_TAG = 'HOTKEY_EVENT_TAG';
const HotkeyContext = createContext<UseHotkeyContext>({} as UseHotkeyContext);
const HotkeyProvider: FunctionComponent<{ hotKeyRegistry: Record<string, KeyBindings>; children: ReactNode}> = ({ hotKeyRegistry, children }) => {
  const $hotkeyChannel = useMemo(() => new EventEmitter(), []);
  const sendHotkeyCommand = useCallback((hotkeyId: string) => {
    $hotkeyChannel.emit(HOTKEY_EVENT_TAG, { hotkeyId });
  }, [$hotkeyChannel]);

  const checkHotkeyPressed = useCallback((e: KeyboardEvent, definitions: Record<string, HotKeyDefinition>): null | HotKeyDefinition => {
    const pressed = Object.values(definitions).find(def => checkPressedKeyCombs(e, hotKeyRegistry[def.id]));
    if (!pressed) {
      return null;
    }

    return pressed;
  }, [hotKeyRegistry]);

  return (
    <HotkeyContext.Provider
      value={{
        sendHotkeyCommand,
        checkHotkeyPressed,
        $hotkeyChannel,
      }}
    >
      {children}
    </HotkeyContext.Provider>
  );
};

/**
 * A hook to listen to multiple hotkeys
 * @param callback callback to be executed when a given hotkey is executed
 * @param hotkeys a collection of hotkeys to be listened. This is used to check if a callback needs to be executed or not
 * */
function useHotKeysEffect(callback: (hotkeyId: string) => void, hotkeys: string[]): void {
  const { $hotkeyChannel } = useContext(HotkeyContext);
  const hotkeyIds = useMemo(() => new Set(hotkeys), [hotkeys]);
  const callbackRef = useRef(callback);

  /**
   * using ref as an instance variable
   * https://reactjs.org/docs/hooks-faq.html#is-there-something-like-instance-variables
   * https://reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback
   * */
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (command: HotkeyCommand) => {
      if (!hotkeyIds.has(command.hotkeyId)) {
        return;
      }

      callbackRef.current?.(command.hotkeyId);
    };

    $hotkeyChannel.on(HOTKEY_EVENT_TAG, handler);

    return () => {
      $hotkeyChannel.off(HOTKEY_EVENT_TAG, handler);
    };
  }, [$hotkeyChannel, callbackRef, hotkeyIds]);
}

/**
 * A hook to listen to a single hotkey
 * @param callback callback to be executed when a given hotkey is executed
 * @param hotkeyId a specific hotkey id to be listened
 * */
function useHotKeyEffect(callback: () => void, hotkeyId: string): void {
  const { $hotkeyChannel } = useContext(HotkeyContext);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    const handler = (command: HotkeyCommand) => {
      if (command.hotkeyId !== hotkeyId) {
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

function useHotKey(): Pick<UseHotkeyContext, 'sendHotkeyCommand' | 'checkHotkeyPressed'> {
  const { sendHotkeyCommand, checkHotkeyPressed } = useContext(HotkeyContext);
  return { sendHotkeyCommand, checkHotkeyPressed };
}

export { HotkeyProvider, useHotKeysEffect, useHotKeyEffect, useHotKey };
