import { HotKeyRegistry } from 'insomnia-common';
import React, { FunctionComponent } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  hotKeyRegistry: HotKeyRegistry;
}

// TODO: get hotKeyRegistry from redux
export const PlaceholderResponsePane: FunctionComponent<Props> = ({ hotKeyRegistry, children }) => (
  <Pane type="response">
    <PaneHeader />
    <PaneBody placeholder>
      <div>
        <table>
          <tbody>
            {[
              hotKeyRefs.REQUEST_SEND,
              hotKeyRefs.REQUEST_FOCUS_URL,
              hotKeyRefs.SHOW_COOKIES_EDITOR,
              hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
              hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
            ].map(({ description, id }) => (
              <tr key={id} style={{ lineHeight: '1em' }}>
                <td style={{ padding: 'var(--padding-sm)', verticalAlign: 'middle' }}>{description}</td>
                <td className="text-right">
                  <code>
                    <Hotkey
                      keyBindings={hotKeyRegistry[id]}
                      useFallbackMessage
                    />
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaneBody>
    {children}
  </Pane>
);
