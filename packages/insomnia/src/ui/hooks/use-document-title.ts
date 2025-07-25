import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router';

import { getProductName } from '../../common/constants';
import type { WorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import type { RequestLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
export const useDocumentTitle = () => {
  const { activeWorkspace, activeEnvironment, activeProject } = useRouteLoaderData(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId',
  ) as WorkspaceLoaderData;

  const { activeRequest } = useRouteLoaderData(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId',
  ) as RequestLoaderData;

  // Update document title
  useEffect(() => {
    let title;
    if (activeWorkspace && activeWorkspace.name) {
      title = activeProject.name;
      title += ` - ${activeWorkspace.name}`;
      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }
      if (activeRequest) {
        title += ` – ${activeRequest.name}`;
      }
    }
    document.title = title || getProductName();
  }, [activeEnvironment, activeProject.name, activeRequest, activeWorkspace]);
};
