// @flow
import type { Workspace } from '../models/workspace';
import { isDesigner } from '../models/helpers/is-model';
import { strings } from './strings';

export const getWorkspaceLabel = (w: Workspace) =>
  isDesigner(w) ? strings.document : strings.collection;
