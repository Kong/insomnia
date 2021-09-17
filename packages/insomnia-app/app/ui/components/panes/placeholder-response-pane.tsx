import React, { FunctionComponent } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import * as hotkeys from '../../../common/hotkeys';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

interface Props {
  hotKeyRegistry: hotkeys.HotKeyRegistry;
}

const PlaceholderResponsePane: FunctionComponent<Props> = ({ hotKeyRegistry, children }) => (
  <Pane type="response">
    <PaneHeader />
    <PaneBody placeholder>
      <div>
        <table className="table--fancy">
          <tbody>
            <tr>
              <td>Send Request</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SEND.id]}
                    useFallbackMessage
                  />
                </code>
              </td>
            </tr>
            <tr>
              <td>Focus Url Bar</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_FOCUS_URL.id]}
                    useFallbackMessage
                  />
                </code>
              </td>
            </tr>
            <tr>
              <td>Manage Cookies</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.SHOW_COOKIES_EDITOR.id]}
                    useFallbackMessage
                  />
                </code>
              </td>
            </tr>
            <tr>
              <td>Edit Environments</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]}
                    useFallbackMessage
                  />
                </code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PaneBody>
    {children}
  </Pane>
);

export default PlaceholderResponsePane;
