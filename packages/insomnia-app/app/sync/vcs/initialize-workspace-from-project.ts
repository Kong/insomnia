import * as models from '../../models';
import { Space } from '../../models/space';
import { Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { Project } from '../types';

export const initializeWorkspaceFromProject = (project: Project, space: Space) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: project.rootDocumentId,
    name: project.name,
    parentId: space._id,
    scope: WorkspaceScopeKeys.collection,
  }
);