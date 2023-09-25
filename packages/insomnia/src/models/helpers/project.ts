import { isDefaultOrganizationProject, Project } from '../project';
export const sortProjects = (projects: Project[]) => [
  ...projects.filter(p => isDefaultOrganizationProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
  ...projects.filter(p => !isDefaultOrganizationProject(p))
    .sort((a, b) => a.name.localeCompare(b.name)),
];
