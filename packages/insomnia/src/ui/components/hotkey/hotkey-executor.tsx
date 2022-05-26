import React, { FunctionComponent, ReactNode } from 'react';

import { hotKeyRefs } from '../../../common';
import { useHotKeysEffect } from './hotkey-context';

type KeyOfHotKeys = keyof typeof hotKeyRefs;
export type HotKeysExecutionMap = Map<KeyOfHotKeys, () => void>;
interface Props {
  children?: ReactNode;
  keysMap: HotKeysExecutionMap;
}

/**
 * This component is to work around the current way <App /> component is written and how hotkeys are executed. This component will need to be removed eventually when we convert the app component and other components into functional.
 * */
export const HotkeyExecutor: FunctionComponent<Props> = ({ children, keysMap }) => {
  useHotKeysEffect((hotkeyId: string) => {
    keysMap.get(hotkeyId)?.();
  }, [
    hotKeyRefs.PREFERENCES_SHOW_GENERAL.id,
    hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS.id,
    hotKeyRefs.SHOW_RECENT_REQUESTS.id,
    hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id,
    hotKeyRefs.REQUEST_SHOW_SETTINGS.id,
    hotKeyRefs.REQUEST_QUICK_SWITCH.id,
    hotKeyRefs.REQUEST_SEND.id,
    hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id,
    hotKeyRefs.SHOW_COOKIES_EDITOR.id,
    hotKeyRefs.REQUEST_QUICK_CREATE.id,
    hotKeyRefs.REQUEST_SHOW_CREATE.id,
    hotKeyRefs.REQUEST_SHOW_DELETE.id,
    hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id,
    hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id,
    hotKeyRefs.REQUEST_SHOW_DUPLICATE.id,
    hotKeyRefs.REQUEST_TOGGLE_PIN.id,
    hotKeyRefs.PLUGIN_RELOAD.id,
    hotKeyRefs.ENVIRONMENT_SHOW_VARIABLE_SOURCE_AND_VALUE.id,
    hotKeyRefs.SIDEBAR_TOGGLE.id,
  ]);

  return <>{children}</>;
};
