import { useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as workspaceOperations from '../../models/helpers/workspace-operations';
import { Workspace, WorkspaceAuthentication } from '../../models/workspace';
import { selectActiveWorkspace } from '../redux/selectors';

export const useActiveWorkspace = () => {
  const activeWorkspace = useSelector(selectActiveWorkspace);

  if (!activeWorkspace || !('authentication' in activeWorkspace)) {
    throw new Error('Tried to load invalid request type');
  }

  const updateAuth = useCallback((authentication: WorkspaceAuthentication) => {
    workspaceOperations.update(activeWorkspace, { authentication });
  }, [activeWorkspace]);

  const { authentication } = activeWorkspace;
  const patchAuth = useCallback((patch: Partial<Workspace['authentication']>) => updateAuth({ ...authentication, ...patch }), [authentication, updateAuth]);

  return {
    activeWorkspace,
    patchAuth,
  };
};
