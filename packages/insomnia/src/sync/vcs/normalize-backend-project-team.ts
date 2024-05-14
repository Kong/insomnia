import { BackendWorkspace, Team } from '../types';

export interface BackendWorkspaceWithTeams extends BackendWorkspace {
  teams: Team[];
}

export interface BackendWorkspaceWithTeam extends BackendWorkspace {
  team: Team;
}

export const normalizeBackendWorkspaceTeam = (backend: BackendWorkspaceWithTeams): BackendWorkspaceWithTeam => ({
  id: backend.id,
  name: backend.name,
  rootDocumentId: backend.rootDocumentId,
  // A backend project is guaranteed to exist on exactly one team
  team: backend.teams[0],
});
