import { isDesign, isEnvironment, isMockServer, Workspace } from '../models/workspace';
import { strings } from './strings';

export const getWorkspaceLabel = (workspace: Workspace) => {
  if (isDesign(workspace)) {
    return strings.document;
  }

  if (isMockServer(workspace)) {
    return strings.mock;
  }

  if (isEnvironment(workspace)) {
    return strings.environment;
  }

  return strings.collection;
};
