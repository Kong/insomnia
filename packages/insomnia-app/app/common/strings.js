// @flow
import type { Workspace } from '../models/workspace';
import { isDocument } from '../models/helpers/is-model';

export const strings = {
  workspace: 'Workspace',
  workspaces: 'Workspaces',
  document: 'Document',
  collection: 'Collection',
  home: 'Dashboard',
};

// Some helpers
export const getWorkspaceLabel = (w: Workspace) =>
  isDocument(w) ? strings.document : strings.collection;
