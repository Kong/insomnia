import React, { FC, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { createRequest } from '../../hooks/create-request';
import { ForceToWorkspace } from '../../redux/modules/helpers';
import { importFile } from '../../redux/modules/import';
import { selectActiveWorkspace, selectSettings } from '../../redux/selectors';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

export const PlaceholderRequestPane: FC = () => {
  const dispatch = useDispatch();
  const { hotKeyRegistry } = useSelector(selectSettings);
  const workspaceId = useSelector(selectActiveWorkspace)?._id;
  const handleImportFile = useCallback(() => dispatch(importFile({ workspaceId, forceToWorkspace: ForceToWorkspace.current })), [workspaceId, dispatch]);

  const createHttpRequest = useCallback(() => {
    if (workspaceId) {
      createRequest({
        requestType: 'HTTP',
        parentId: workspaceId,
        workspaceId: workspaceId,
      });
    }
  }, [workspaceId]);

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
                      keyBindings={hotKeyRegistry.request_createHTTP}
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
                      keyBindings={hotKeyRegistry.request_quickSwitch}
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
                      keyBindings={hotKeyRegistry.environment_showEditor}
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
            <button className="btn inline-block btn--clicky" onClick={createHttpRequest}>
              New HTTP Request
            </button>
          </div>
        </div>
      </PaneBody>
    </Pane>
  );
};
