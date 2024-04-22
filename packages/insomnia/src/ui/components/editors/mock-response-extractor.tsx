import fs from 'fs/promises';
import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useFetcher,
  useRouteLoaderData,
} from 'react-router-dom';

import { getContentTypeName, getMimeTypeFromContentType } from '../../../common/constants';
import { invariant } from '../../../utils/invariant';
import { isInMockContentTypeList, useMockRoutePatcher } from '../../routes/mock-route';
import { RequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';

export const MockResponseExtractor = () => {
  const {
    activeWorkspace,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const { mockServerAndRoutes, activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchMockRoute = useMockRoutePatcher();
  const navigate = useNavigate();
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams();
  const fetcher = useFetcher();
  const [selectedMockServer, setSelectedMockServer] = useState('');
  const [selectedMockRoute, setSelectedMockRoute] = useState('');
  const maybeMimeType = activeResponse && getMimeTypeFromContentType(activeResponse.contentType);
  const mimeType = maybeMimeType && isInMockContentTypeList(maybeMimeType) ? maybeMimeType : 'text/plain';
  return (
    <div className="px-32 h-full flex flex-col justify-center">
      <div className="flex place-content-center text-9xl pb-2 text-[--hl-md]">
        <Icon icon="cube" />
      </div>
      <div className="flex place-content-center pb-2">
        Transform this {getContentTypeName(activeResponse?.contentType) || ''} response to a new mock route or overwrite an existing one.
      </div>
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (selectedMockServer && selectedMockRoute) {
            if (activeResponse) {
              // TODO: move this out of the renderer, and upsert mock
              const body = await fs.readFile(activeResponse.bodyPath);

              patchMockRoute(selectedMockRoute, {
                body: body.toString(),
                mimeType,
                statusCode: activeResponse.statusCode,
                headers: activeResponse.headers,
              });
            }
            return;
          }
          let path = '/new-route';
          try {
            path = activeResponse ? new URL(activeResponse.url).pathname : '/new-route';
          } catch (e) {
            console.log(e);
          }
          // Create new mock server and route
          if (!selectedMockServer) {
            showPrompt({
              title: 'Create Mock Route',
              defaultValue: path,
              label: 'Name',
              onComplete: async name => {
                invariant(activeResponse, 'Active response must be defined');
                const body = await fs.readFile(activeResponse.bodyPath);
                // TODO: consider setting selected mock server here rather than redirecting
                fetcher.submit(
                  JSON.stringify({
                    name: name,
                    body: body.toString(),
                    mimeType,
                    statusCode: activeResponse.statusCode,
                    headers: activeResponse.headers,
                    mockServerName: activeWorkspace.name,
                  }),
                  {
                    encType: 'application/json',
                    method: 'post',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                  }
                );
              },
            });
            return;
          }
          // Create new mock route
          if (!selectedMockRoute) {
            showPrompt({
              title: 'Create Mock Route',
              defaultValue: path,
              label: 'Name',
              onComplete: async name => {
                invariant(activeResponse, 'Active response must be defined');
                const body = await fs.readFile(activeResponse.bodyPath);
                const hasRouteInServer = mockServerAndRoutes.find(s => s._id === selectedMockServer)?.routes.find(r => r.name === name);
                if (hasRouteInServer) {
                  showModal(AlertModal, {
                    title: 'Error',
                    message: `Path "${name}" must be unique. Please enter a different name.`,
                  });
                  return;
                };
                fetcher.submit(
                  JSON.stringify({
                    name: name,
                    parentId: selectedMockServer,
                    body: body.toString(),
                    mimeType,
                    statusCode: activeResponse.statusCode,
                    headers: activeResponse.headers,
                  }),
                  {
                    encType: 'application/json',
                    method: 'post',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                  }
                );
              },
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
                  setSelectedMockRoute('');
                }}
              >
                <option value="">-- Create new... --</option>
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
                Select from created mock routes to overwrite with this response
              </HelpTooltip>
              <select
                value={selectedMockRoute}
                onChange={event => {
                  const selected = event.currentTarget.value;
                  setSelectedMockRoute(selected);
                }}
              >
                <option value="">-- Create new... --</option>
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
        <div className="flex mt-2">
          <Button
            type="submit"
            className="mr-2 hover:no-underline bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] aria-pressed:bg-opacity-80 focus:ring-[--hl-md] transition-colors rounded-sm"
          >
            {selectedMockRoute ? 'Overwrite' : 'Create'}
          </Button>
          <Button
            isDisabled={!selectedMockServer || !selectedMockRoute}
            onPress={() => {
              const mockWorkspaceId = mockServerAndRoutes.find(s => s._id === selectedMockServer)?.parentId;
              navigate(`/organization/${organizationId}/project/${projectId}/workspace/${mockWorkspaceId}/mock-server/mock-route/${selectedMockRoute}`);
            }}
            className="flex items-center justify-center py-2 px-3 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          >
            Go to mock
          </Button>
        </div>
      </form>
    </div>
  );
};
