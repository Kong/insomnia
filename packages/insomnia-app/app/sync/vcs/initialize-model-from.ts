import * as models from '../../models';
import { RemoteSpace } from '../../models/space';
import { Space } from '../../models/space';
import { Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { Team } from '../types';
import { Project } from '../types';

export const initializeSpaceFromTeam = (team: Team) => models.initModel<RemoteSpace>(
  models.space.type,
  {
    _id: `${models.space.prefix}_${team.id}`,
    remoteId: team.id,
    name: team.name,
  }
);

export const initializeWorkspaceFromProject = (project: Project, space: Space) => models.initModel<Workspace>(
  models.workspace.type,
  {
    _id: project.rootDocumentId,
    name: project.name,
    parentId: space._id,
    scope: WorkspaceScopeKeys.collection,
  }
);