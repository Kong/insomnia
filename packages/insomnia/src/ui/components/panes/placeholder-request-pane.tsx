import React, { FC, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { createRequest } from '../../hooks/create-request';
import { RootLoaderData } from '../../routes/root';
import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

export const PlaceholderRequestPane: FC = () => {
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  const { hotKeyRegistry } = settings;
  const { workspaceId } = useParams<{ workspaceId: string }>();
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
            <button className="btn inline-block btn--clicky" onClick={createHttpRequest}>
              New HTTP Request
            </button>
          </div>
        </div>
      </PaneBody>
    </Pane>
  );
};
