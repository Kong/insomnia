import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouteLoaderData } from 'react-router-dom';

import { ACTIVITY_HOME, getProductName } from '../../common/constants';
import { Request } from '../../models/request';
import { selectActiveActivity, selectActiveEnvironment, selectActiveProject, selectActiveWorkspace, selectActiveWorkspaceName } from '../redux/selectors';
export const useDocumentTitle = () => {
  const activeActivity = useSelector(selectActiveActivity);
  const activeProject = useSelector(selectActiveProject);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
  const activeWorkspace = useSelector(selectActiveWorkspace);

  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useRouteLoaderData('request/:requestId') as Request;

  // Update document title
  useEffect(() => {
    let title;
    if (activeActivity === ACTIVITY_HOME) {
      title = getProductName();
    } else if (activeWorkspace && activeWorkspaceName) {
      title = activeProject.name;
      title += ` - ${activeWorkspaceName}`;
      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }
      if (activeRequest) {
        title += ` – ${activeRequest.name}`;
      }
    }
    document.title = title || getProductName();
  }, [activeActivity, activeEnvironment, activeProject.name, activeRequest, activeWorkspace, activeWorkspaceName]);

};
