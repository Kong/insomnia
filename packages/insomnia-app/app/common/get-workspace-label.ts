import { isDesign, Workspace } from '../models/workspace';
import { strings } from './strings';

export const getWorkspaceLabel = (workspace: Workspace) =>
  isDesign(workspace) ? strings.document : strings.collection;
