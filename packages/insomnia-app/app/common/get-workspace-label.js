// @flow
import type { Workspace } from '../models/workspace';
import { isDesign } from '../models/helpers/is-model';
import { strings } from './strings';

export const getWorkspaceLabel = (w: Workspace) =>
  isDesign(w) ? strings.document : strings.collection;
