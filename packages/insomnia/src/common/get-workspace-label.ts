import { isDesign, isMockServer, Workspace } from '../models/workspace';
import { strings } from './strings';

export const getWorkspaceLabel = (workspace: Workspace) =>
  isDesign(workspace)
    ? strings.document
    : isMockServer(workspace)
      ? strings.mock
      : strings.collection;
