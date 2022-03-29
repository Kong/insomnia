import { BackendProject, Team } from '../types';

export interface BackendProjectWithTeams extends BackendProject {
  teams: Team[];
}

export interface BackendProjectWithTeam extends BackendProject {
  team: Team;
}

export const normalizeBackendProjectTeam = (backend: BackendProjectWithTeams): BackendProjectWithTeam => ({
  id: backend.id,
  name: backend.name,
  rootDocumentId: backend.rootDocumentId,
  // A backend project is guaranteed to exist on exactly one team
  team: backend.teams[0],
});
