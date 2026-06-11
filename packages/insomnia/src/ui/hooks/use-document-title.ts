import { useEffect } from 'react';

import { getProductName } from '../../common/constants';
import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
export const useDocumentTitle = () => {
  const { activeWorkspace, activeEnvironment, activeProject } = useWorkspaceLoaderData() || {};

  const requestData = useRequestLoaderData();

  // Update document title
  useEffect(() => {
    let title;
    if (activeWorkspace && activeWorkspace.name) {
      title = activeProject && activeProject.name;
      title += ` - ${activeWorkspace.name}`;
      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }
      if (requestData?.activeRequest) {
        title += ` – ${requestData.activeRequest.name}`;
      }
    }
    document.title = title || getProductName();
  }, [activeEnvironment, activeProject, activeProject?.name, activeWorkspace, requestData?.activeRequest]);
};
