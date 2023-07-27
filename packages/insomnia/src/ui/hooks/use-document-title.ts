import { useEffect } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { getProductName } from '../../common/constants';
import { Request } from '../../models/request';
import { RequestLoaderData } from '../routes/request';
import { WorkspaceLoaderData } from '../routes/workspace';
export const useDocumentTitle = () => {
  const {
    activeWorkspace,
    activeEnvironment,
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const { activeRequest } = useRouteLoaderData('request/:requestId') as RequestLoaderData<Request, any>;

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
