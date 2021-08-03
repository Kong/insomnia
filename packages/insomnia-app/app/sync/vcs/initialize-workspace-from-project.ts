import * as models from '../../models';
import { Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { ProjectWithTeam } from './normalize-project-team';

export const initializeWorkspaceFromProject = (project: ProjectWithTeam) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: project.rootDocumentId,
    name: project.name,
    parentId: project.team.id,
    scope: WorkspaceScopeKeys.collection,
  }
);