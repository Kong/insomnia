// @flow
import React from 'react';
import Hotkey from '../hotkey';
import { hotKeyRefs } from '../../../common/hotkeys';
import * as hotkeys from '../../../common/hotkeys';
import type { Request } from '../../../models/request';
import { Pane, PaneBody, PaneHeader } from './pane';
import type { HandleImportFileCallback } from '../wrapper';

type Props = {
  hotKeyRegistry: hotkeys.HotKeyRegistry,
  handleImportFile: HandleImportFileCallback,
  handleCreateRequest: () => Promise<Request>,
};

const PlaceholderRequestPane = ({
  hotKeyRegistry,
  handleImportFile,
  handleCreateRequest,
}: Props) => (
  <Pane type="request">
    <PaneHeader />
    <PaneBody placeholder>
      <div>
        <table className="table--fancy">
          <tbody>
            <tr>
              <td>New Request</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE.id]}
                    useFallbackMessage
                  />
                </code>
              </td>
            </tr>
            <tr>
              <td>Switch Requests</td>
              <td className="text-right">
                <code>
                  <Hotkey
                    keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_QUICK_SWITCH.id]}
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

        <div className="text-center pane__body--placeholder__cta">
          <button className="btn inline-block btn--clicky" onClick={handleImportFile}>
            Import from File
          </button>
          <button className="btn inline-block btn--clicky" onClick={handleCreateRequest}>
            New Request
          </button>
        </div>
      </div>
    </PaneBody>
  </Pane>
);

export default PlaceholderRequestPane;
