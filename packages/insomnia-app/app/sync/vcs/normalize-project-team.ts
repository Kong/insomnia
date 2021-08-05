import { Project, Team } from '../types';

export interface ProjectWithTeams extends Project {
  teams: Team[];
}

export interface ProjectWithTeam extends Project {
  team: Team;
}

export const normalizeProjectTeam = (project: ProjectWithTeams): ProjectWithTeam => ({
  id: project.id,
  name: project.name,
  rootDocumentId: project.rootDocumentId,
  // A project is guaranteed to exist on exactly one team
  team: project.teams[0],
});