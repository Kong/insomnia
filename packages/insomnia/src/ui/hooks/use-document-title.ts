import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import { getProductName } from '../../common/constants';
import { selectActiveRequest } from '../redux/selectors';
import { WorkspaceLoaderData } from '../routes/workspace';

export const useDocumentTitle = () => {
  const {
    activeWorkspace,
    activeEnvironment,
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const activeRequest = useSelector(selectActiveRequest);
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
