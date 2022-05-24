import React, { FunctionComponent, ReactNode } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { useHotKeysEffect } from './hotkeys-context';

type KeyOfHotKeys = keyof typeof hotKeyRefs;
export type HotKeysExecutionMap = Map<KeyOfHotKeys, () => void>;
interface Props {
  children?: ReactNode;
  keysMap: HotKeysExecutionMap;
}

// TODO: This component should be removed when the app component becomes a functional component.
export const HotkeysExecutor: FunctionComponent<Props> = ({ children, keysMap }) => {
  useHotKeysEffect((hotkeyId: string) => {
    keysMap.get(hotkeyId)?.();
  }, [
    // TODO: Minimize the number of these hotkey executions in a single component by decoupling its imperative operations the sub-ordinary components from App
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
