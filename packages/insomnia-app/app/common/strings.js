// @flow
import type { Workspace } from '../models/workspace';
import { isDesigner } from '../models/helpers/is-model';
import { pluralize } from './misc';

export const strings = {
  workspace: 'Workspace',
  workspaces: 'Workspaces',
  document: 'Document',
  collection: 'Collection',
  home: 'Dashboard',
};

export const stringsPlural = {
  document: pluralize(strings.document),
  collection: pluralize(strings.collection),
};

// Some helpers
export const getWorkspaceLabel = (w: Workspace) =>
  isDesigner(w) ? strings.document : strings.collection;
