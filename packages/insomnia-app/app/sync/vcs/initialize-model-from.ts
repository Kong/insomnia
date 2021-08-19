import * as models from '../../models';
import { RemoteSpace } from '../../models/project';
import { Space } from '../../models/project';
import { Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { Team } from '../types';
import { BackendProject } from '../types';

export const initializeSpaceFromTeam = (team: Team) => models.initModel<RemoteSpace>(
  models.space.type,
  {
    _id: `${models.space.prefix}_${team.id}`,
    remoteId: team.id,
    name: team.name,
  }
);

export const initializeWorkspaceFromProject = (backendProject: BackendProject, space: Space) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: backendProject.rootDocumentId,
    name: backendProject.name,
    parentId: space._id,
    scope: WorkspaceScopeKeys.collection,
  }
);
