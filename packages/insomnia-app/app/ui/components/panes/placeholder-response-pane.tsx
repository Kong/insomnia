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
        <table className="table--fancy">
          <tbody>
            {[
              {
                name: 'Send Request',
                keyBindings: hotKeyRegistry[hotKeyRefs.REQUEST_SEND.id],
              },
              {
                name: 'Focus Url Bar',
                keyBindings: hotKeyRegistry[hotKeyRefs.REQUEST_FOCUS_URL.id],
              },
              {
                name: 'Manage Cookies',
                keyBindings: hotKeyRegistry[hotKeyRefs.SHOW_COOKIES_EDITOR.id],
              },
              {
                name: 'Edit Environments',
                keyBindings: hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id],
              },
            ].map(({ name, keyBindings }) => (
              <tr key={name} style={{ lineHeight: '1em' }}>
                <td className="valign-middle">{name}</td>
                <td className="text-right">
                  <code>
                    <Hotkey
                      keyBindings={keyBindings}
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
