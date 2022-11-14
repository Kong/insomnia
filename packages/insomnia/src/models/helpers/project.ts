import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../project';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(isDefaultProject),
  ...projects.filter(p => isLocalProject(p) && !isDefaultProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(isRemoteProject)
    .sort((a, b) => a.name.localeCompare(b.name)),
];
