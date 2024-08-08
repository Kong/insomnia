import React, { type FC, type PropsWithChildren } from 'react';

import { keyboardShortcutDescriptions } from '../../../common/hotkeys';
import type { KeyboardShortcut } from '../../../common/settings';
import { useRootLoaderData } from '../../routes/root';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

export const PlaceholderResponsePane: FC<PropsWithChildren<{}>> = ({ children }) => {
  const {
    settings,
  } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  return (
    <Pane type="response">
      <PaneHeader />
      <PaneBody placeholder>
        <div className="flex flex-col items-center justify-center whitespace-nowrap">
          {[
            'request_send',
            'request_focusUrl',
            'showCookiesEditor',
            'environment_showEditor',
            'preferences_showKeyboardShortcuts',
          ].map(shortcut => (
            <div key={shortcut} className="flex items-center justify-between w-full m-[--padding-sm]">
              <div className="mr-8">
                {keyboardShortcutDescriptions[shortcut as KeyboardShortcut]}
              </div>
              <code>
                <Hotkey
                  keyBindings={hotKeyRegistry[shortcut as KeyboardShortcut]}
                  useFallbackMessage
                />
              </code>
            </div>
          ))}
        </div>
      </PaneBody>
      {children}
    </Pane>
  );
};
