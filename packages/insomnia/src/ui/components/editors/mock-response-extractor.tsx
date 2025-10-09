import React, { useState } from 'react';
import { Button } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';

import { isSocketIOResponse } from '~/models/socket-io-response';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  isInMockContentTypeList,
  useMockRoutePatcher,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId';

import { getContentTypeName, getMimeTypeFromContentType } from '../../../common/constants';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { MockRouteModal } from '../modals/mock-route-modal';

export const MockResponseExtractor = () => {
  const requestLoaderData = useRequestLoaderData()!;
  const { activeResponse } = requestLoaderData;
  let mockServerAndRoutes = 'mockServerAndRoutes' in requestLoaderData ? requestLoaderData.mockServerAndRoutes : [];

  const { activeProject, activeWorkspace } = useWorkspaceLoaderData()!;
  const isLocalProject = !activeProject?.remoteId;
  const { currentPlan } = useOrganizationLoaderData()!;
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
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const [selectedMockServer, setSelectedMockServer] = useState(
    canOnlyChooseExistingMockServer ? mockServerAndRoutes[0]._id : '',
  );
  const [selectedMockRoute, setSelectedMockRoute] = useState('');
  const [mockRouteModalState, setMockRouteModalState] = useState<{
    isOpen: boolean;
    title: string;
    defaultPath?: string;
    defaultMethod?: string;
    mode: 'create' | 'edit';
    mockRouteId?: string;
    mockServerId?: string;
    mockServerName?: string;
  } | null>(null);
  if (tipPreventingUserFromCreatingMockRoute) {
    return (
      <div className="flex h-full flex-col justify-center px-32">
        <div className="flex place-content-center pb-8 text-9xl text-[--hl-md]">
          <Icon icon="cube" />
        </div>
        <div className="flex place-content-center whitespace-pre-line pb-2">
          {tipPreventingUserFromCreatingMockRoute}
        </div>
      </div>
    );
  }
  if (activeResponse && isSocketIOResponse(activeResponse) && !('contentType' in activeResponse)) {
    return (
      <div className="flex h-full flex-col justify-center px-32">
        <div className="flex place-content-center pb-8 text-9xl text-[--hl-md]">
          <Icon icon="cube" />
        </div>
        <div className="flex place-content-center whitespace-pre-line pb-2">
          You can't create a mock server route from a Socket.IO response
        </div>
      </div>
    );
  }

  const maybeMimeType = activeResponse && getMimeTypeFromContentType(activeResponse.contentType);
  const mimeType = maybeMimeType && isInMockContentTypeList(maybeMimeType) ? maybeMimeType : 'text/plain';

  return (
    <div className="flex h-full flex-col justify-center px-32">
      <div className="flex place-content-center pb-8 text-9xl text-[--hl-md]">
        <Icon icon="cube" />
      </div>
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
            if (activeResponse && 'bodyPath' in activeResponse) {
              const body = await window.main.secureReadFile({
                path: activeResponse.bodyPath,
              });
              const headersWithoutContentLength = activeResponse.headers.filter(
                h => h.name.toLowerCase() !== 'content-length',
              );

              patchMockRoute(selectedMockRoute, {
                body: body.toString(),
                mimeType,
                statusCode: activeResponse.statusCode,
                headers: headersWithoutContentLength,
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
          if (!selectedMockServer) {
            setMockRouteModalState({
              isOpen: true,
              title: 'Create Mock Route',
              defaultPath: path,
              defaultMethod: 'GET',
              mode: 'create',
              mockServerName: activeWorkspace.name,
            });
            return;
          }
          if (!selectedMockRoute) {
            setMockRouteModalState({
              isOpen: true,
              title: 'Create Mock Route',
              defaultPath: path,
              defaultMethod: 'GET',
              mode: 'create',
              mockServerId: selectedMockServer,
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
                      {w.method} {w.name}
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
      {mockRouteModalState && (
        <MockRouteModal
          isOpen={mockRouteModalState.isOpen}
          onOpenChange={isOpen => {
            if (!isOpen) {
              setMockRouteModalState(null);
            }
          }}
          title={mockRouteModalState.title}
          defaultPath={mockRouteModalState.defaultPath}
          defaultMethod={mockRouteModalState.defaultMethod}
          mode={mockRouteModalState.mode}
          mockRouteId={mockRouteModalState.mockRouteId}
          mockServerId={mockRouteModalState.mockServerId}
          mockServerName={mockRouteModalState.mockServerName}
          responseData={
            activeResponse
              ? {
                  bodyPath: 'bodyPath' in activeResponse ? activeResponse.bodyPath : undefined,
                  headers: activeResponse.headers.filter(h => h.name.toLowerCase() !== 'content-length'),
                  statusCode: activeResponse.statusCode,
                  mimeType,
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
