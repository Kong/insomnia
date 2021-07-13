import React, { FC, useCallback } from 'react';
import Hotkey from '../hotkey';
import { hotKeyRefs } from '../../../common/hotkeys';
import * as hotkeys from '../../../common/hotkeys';
import { Pane, PaneBody, PaneHeader } from './pane';
import { useDispatch, useSelector } from 'react-redux';
import { importFile } from '../../redux/modules/import';
import { selectActiveWorkspace } from '../../redux/selectors';

interface Props {
  hotKeyRegistry: hotkeys.HotKeyRegistry;
  handleCreateRequest: () => void;
}

const PlaceholderRequestPane: FC<Props> = ({
  hotKeyRegistry,
  handleCreateRequest,
}) => {
  const dispatch = useDispatch();
  const workspaceId = useSelector(selectActiveWorkspace)?._id;
  const handleImportFile = useCallback(() => dispatch(importFile({ workspaceId })), [workspaceId, dispatch]);

  return (
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
                      useFallbackMessage />
                  </code>
                </td>
              </tr>
              <tr>
                <td>Switch Requests</td>
                <td className="text-right">
                  <code>
                    <Hotkey
                      keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_QUICK_SWITCH.id]}
                      useFallbackMessage />
                  </code>
                </td>
              </tr>
              <tr>
                <td>Edit Environments</td>
                <td className="text-right">
                  <code>
                    <Hotkey
                      keyBindings={hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]}
                      useFallbackMessage />
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
};

export default PlaceholderRequestPane;
