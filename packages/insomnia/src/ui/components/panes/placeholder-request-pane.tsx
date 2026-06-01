import React, { type FC, useCallback } from 'react';
import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';

import { Hotkey } from '../hotkey';
import { Pane, PaneBody, PaneHeader } from './pane';

export const PlaceholderRequestPane: FC = () => {
  const { settings } = useRootLoaderData()!;
  const { hotKeyRegistry } = settings;
  const requestFetcher = useRequestNewActionFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const createHttpRequest = useCallback(
    () =>
      requestFetcher.submit({
        organizationId,
        projectId,
        workspaceId,
        requestType: 'HTTP',
        parentId: workspaceId,
        metrics: {
          source: 'placeholder-request-pane',
        }
      }),
    [requestFetcher, organizationId, projectId, workspaceId],
  );

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
                    <Hotkey keyBindings={hotKeyRegistry.request_createHTTP} useFallbackMessage />
                  </code>
                </td>
              </tr>
              <tr>
                <td>Switch Requests</td>
                <td className="text-right">
                  <code>
                    <Hotkey keyBindings={hotKeyRegistry.request_quickSwitch} useFallbackMessage />
                  </code>
                </td>
              </tr>
              <tr>
                <td>Edit Environments</td>
                <td className="text-right">
                  <code>
                    <Hotkey keyBindings={hotKeyRegistry.environment_showEditor} useFallbackMessage />
                  </code>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="pane__body--placeholder__cta text-center">
            <button className="btn btn--clicky inline-block" onClick={createHttpRequest}>
              New HTTP Request
            </button>
          </div>
        </div>
      </PaneBody>
    </Pane>
  );
};
