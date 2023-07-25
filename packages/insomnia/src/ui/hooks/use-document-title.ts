import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import { ACTIVITY_HOME, getProductName } from '../../common/constants';
import { selectActiveActivity, selectActiveRequest } from '../redux/selectors';
import { WorkspaceLoaderData } from '../routes/workspace';

export const useDocumentTitle = () => {
  const activeActivity = useSelector(selectActiveActivity);
  const {
    activeWorkspace,
    activeEnvironment,
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const activeRequest = useSelector(selectActiveRequest);
  // Update document title
  useEffect(() => {
    let title;
    if (activeActivity === ACTIVITY_HOME) {
      title = getProductName();
    } else if (activeWorkspace && activeWorkspace.name) {
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
  }, [activeActivity, activeEnvironment, activeProject.name, activeRequest, activeWorkspace]);

};
