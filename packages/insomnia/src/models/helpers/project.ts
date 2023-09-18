import { isLocalProject, isRemoteProject, Project } from '../project';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(p => isLocalProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(isRemoteProject)
    .sort((a, b) => a.name.localeCompare(b.name)),
];
