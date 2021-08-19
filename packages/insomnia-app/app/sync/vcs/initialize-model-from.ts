import * as models from '../../models';
import { RemoteProject } from '../../models/project';
import { Project } from '../../models/project';
import { Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { Team } from '../types';
import { BackendProject } from '../types';

export const initializeSpaceFromTeam = (team: Team) => models.initModel<RemoteProject>(
  models.project.type,
  {
    _id: `${models.project.prefix}_${team.id}`,
    remoteId: team.id,
    name: team.name,
  }
);

export const initializeWorkspaceFromProject = (backendProject: BackendProject, space: Project) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: backendProject.rootDocumentId,
    name: backendProject.name,
    parentId: space._id,
    scope: WorkspaceScopeKeys.collection,
  }
);
