import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../project';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(isDefaultProject),
  ...projects.filter(isLocalProject),
  ...projects.filter(isRemoteProject),
  ...projects.filter(p => !isLocalProject(p) && !isRemoteProject(p) && !isDefaultProject(p)),
];
