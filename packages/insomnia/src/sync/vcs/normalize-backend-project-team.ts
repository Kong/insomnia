import { BackendProject, Team } from '../types';

export interface BackendProjectWithTeams extends BackendProject {
  teams: Team[];
}

export interface BackendProjectWithTeam extends BackendProject {
  team: Team;
}
