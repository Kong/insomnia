import { isDesign, Workspace } from '../models/workspace';
import { strings } from './strings';

export const getWorkspaceLabel = (w: Workspace) =>
  isDesign(w) ? strings.document : strings.collection;
