import fs from 'fs/promises';
import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { useMockRoutePatcher } from '../../routes/mock-route';
import { RequestLoaderData } from '../../routes/request';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';

export const MockResponseExtractor = () => {
  const { mockServerAndRoutes, activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const navigate = useNavigate();
  const {
    organizationId,
    projectId,
  } = useParams();
  const [selectedMockServer, setSelectedMockServer] = useState('');
  const [selectedMockRoute, setSelectedMockRoute] = useState('');
  return (
    <div className="px-32 h-full flex flex-col justify-center">
      <div className="flex place-content-center text-9xl pb-2">
        <Icon icon="cube" />
      </div>
      <div className="flex place-content-center pb-2">
        Export this response to a mock route.
      </div>
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (!selectedMockServer || !selectedMockRoute) {
            return;
          }

          if (activeResponse) {
            // TODO: move this out of the renderer, and upsert mock
            const body = await fs.readFile(activeResponse.bodyPath);

            patchMockRoute(selectedMockRoute, {
              body: body.toString(),
              mimeType: activeResponse.contentType,
              statusCode: activeResponse.statusCode,
              headers: activeResponse.headers,
            });
          }
        }}
      >
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Choose Mock Server
              <HelpTooltip position="top" className="space-left">
                Select from created mock servers to add the route to
              </HelpTooltip>
              <select
                value={selectedMockServer}
                onChange={event => {
                  const selected = event.currentTarget.value;
                  setSelectedMockServer(selected);
                }}
              >
                <option value="">-- Select... --</option>
                {mockServerAndRoutes
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))
                }
              </select>
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Choose Mock Route
              <HelpTooltip position="top" className="space-left">
                Select from created mock routes to send this request to
              </HelpTooltip>
              <select
                value={selectedMockRoute}
                onChange={event => {
                  const selected = event.currentTarget.value;
                  setSelectedMockRoute(selected);
                }}
              >
                <option value="">-- Select... --</option>
                {mockServerAndRoutes.find(s => s._id === selectedMockServer)?.routes
                  .map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))
                }
              </select>
            </label>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            isDisabled={!selectedMockServer || !selectedMockRoute}
            onPress={() => {
              const mockWorkspaceId = mockServerAndRoutes.find(s => s._id === selectedMockServer)?.parentId;
              navigate(`/organization/${organizationId}/project/${projectId}/workspace/${mockWorkspaceId}/mock-server/mock-route/${selectedMockRoute}`);
            }}
            className="mr-2 hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
          >
            Go to mock
          </Button>
          <Button
            type="submit"
            isDisabled={!selectedMockServer || !selectedMockRoute}
            className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
          >
            Export
          </Button>
        </div>
      </form>
    </div>
  );
};
