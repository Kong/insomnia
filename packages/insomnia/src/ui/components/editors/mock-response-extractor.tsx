import fs from 'node:fs/promises';

import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';
import { useFetcher, useRouteLoaderData } from 'react-router';

import { getContentTypeName, getMimeTypeFromContentType } from '../../../common/constants';
import type { ResponseHeader } from '../../../models/response';
import { invariant } from '../../../utils/invariant';
import type { RequestLoaderData } from '../../routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  isInMockContentTypeList,
  useMockRoutePatcher,
} from '../../routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route';
import type { OrganizationLoaderData } from '../../routes/organization';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';

export const MockResponseExtractor = () => {
  // file://./../../routes/request.tsx#loader
  const requestLoaderData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const { activeResponse } = requestLoaderData;
  let { mockServerAndRoutes } = requestLoaderData;

  // file://./../../routes/workspace.tsx#workspaceLoader
  const { activeProject, activeWorkspace } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const isLocalProject = !activeProject?.remoteId;
  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const isEnterprise = currentPlan?.type.includes('enterprise');

  // In a local project, users are not allowed to create a cloud mock server, only enterprise users can create a self-hosted mock server.
  // In a local project, users without enterprise plan can't create cloud mock server route from a request response
  // In a local project, users who are with an enterprise plan but does not have an existing self-hosted mock server need to create a self-hosted mock server manually before they create a self-hosted mock server route from a request response
  // In a local project, users who are with an enterprise plan and have existing self-hosted mock servers as well can create a mock server route from a request response in existing self-hosted mock servers
  let tipPreventingUserFromCreatingMockRoute = '';
  let canOnlyChooseExistingMockServer = false;
  if (isLocalProject) {
    if (!isEnterprise) {
      tipPreventingUserFromCreatingMockRoute = `You can't create a cloud mock server route in a local project.
Please alter your project to a cloud project to create a cloud mock server route.
If you want to create a self-hosted mock server route, you need to upgrade to an enterprise plan.`;
    } else {
      mockServerAndRoutes = mockServerAndRoutes.filter(({ useInsomniaCloud }) => !useInsomniaCloud);
      if (mockServerAndRoutes.length === 0) {
        // does not have existing self-hosted mock server
        tipPreventingUserFromCreatingMockRoute = `You can't create a cloud mock server route in a local project.
If you want to create a self-hosted mock server route from a request response in a local project, please create a self-hosted mock server in project panel manually first.`;
      } else {
        // has existing self-hosted mock server
        canOnlyChooseExistingMockServer = true;
      }
    }
  }

  const patchMockRoute = useMockRoutePatcher();
  const navigate = useNavigate();
  const { organizationId, projectId, workspaceId } = useParams();
  const fetcher = useFetcher();
  const [selectedMockServer, setSelectedMockServer] = useState(
    canOnlyChooseExistingMockServer ? mockServerAndRoutes[0]._id : '',
  );
  const [selectedMockRoute, setSelectedMockRoute] = useState('');
  const maybeMimeType = activeResponse && getMimeTypeFromContentType(activeResponse.contentType);
  const mimeType = maybeMimeType && isInMockContentTypeList(maybeMimeType) ? maybeMimeType : 'text/plain';
  return (
    <div className="flex h-full flex-col justify-center px-32">
      <div className="flex place-content-center pb-8 text-9xl text-[--hl-md]">
        <Icon icon="cube" />
      </div>
      {tipPreventingUserFromCreatingMockRoute ? (
        <div className="flex place-content-center whitespace-pre-line pb-2">
          {tipPreventingUserFromCreatingMockRoute}
        </div>
      ) : (
        <>
          <div className="flex place-content-center pb-2">
            Transform this
            {activeResponse?.contentType
              ? getContentTypeName(activeResponse?.contentType) === 'Other'
                ? ''
                : ` ${getContentTypeName(activeResponse?.contentType)}`
              : ''}{' '}
            response to a new mock route or overwrite an existing one.
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
                    // auth mechanism is too sensitive to allow content length checks
                    const headersWithoutContentLength: ResponseHeader[] = activeResponse.headers.filter(
                      h => h.name.toLowerCase() !== 'content-length',
                    );
                    // file://./../../routes/actions.tsx#createMockRouteAction
                    fetcher.submit(
                      JSON.stringify({
                        name: name,
                        body: body.toString(),
                        mimeType,
                        statusCode: activeResponse.statusCode,
                        headers: headersWithoutContentLength,
                        mockServerName: activeWorkspace.name,
                      }),
                      {
                        encType: 'application/json',
                        method: 'post',
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                      },
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
                    const hasRouteInServer = mockServerAndRoutes
                      .find(s => s._id === selectedMockServer)
                      ?.routes.find(r => r.name === name && r.method.toUpperCase() === 'GET');
                    if (hasRouteInServer) {
                      showModal(AlertModal, {
                        title: 'Error',
                        message: `Path "${name}" and method must be unique. Please enter a different name.`,
                      });
                      return;
                    }
                    // auth mechanism is too sensitive to allow content length checks
                    const headersWithoutContentLength: ResponseHeader[] = activeResponse.headers.filter(
                      h => h.name.toLowerCase() !== 'content-length',
                    );
                    fetcher.submit(
                      JSON.stringify({
                        name: name,
                        parentId: selectedMockServer,
                        body: body.toString(),
                        mimeType,
                        statusCode: activeResponse.statusCode,
                        headers: headersWithoutContentLength,
                      }),
                      {
                        encType: 'application/json',
                        method: 'post',
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/mock-server/mock-route/new`,
                      },
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
                    {!canOnlyChooseExistingMockServer && <option value="">-- Create new --</option>}
                    {mockServerAndRoutes.map(w => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
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
                    <option value="">-- Create new --</option>
                    {mockServerAndRoutes
                      .find(s => s._id === selectedMockServer)
                      ?.routes.map(w => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-2 flex">
              <Button
                type="submit"
                className="mr-2 rounded-sm border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline focus:ring-[--hl-md] aria-pressed:bg-opacity-80"
              >
                {selectedMockRoute ? 'Overwrite' : 'Create'}
              </Button>
              <Button
                isDisabled={!selectedMockServer || !selectedMockRoute}
                onPress={() => {
                  const mockWorkspaceId = mockServerAndRoutes.find(s => s._id === selectedMockServer)?.parentId;
                  navigate(
                    `/organization/${organizationId}/project/${projectId}/workspace/${mockWorkspaceId}/mock-server/mock-route/${selectedMockRoute}`,
                  );
                }}
                className="flex items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-3 py-2 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              >
                Go to mock
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};
