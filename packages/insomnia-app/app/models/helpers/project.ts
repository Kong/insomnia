import { ascend, descend, prop, sortWith } from 'ramda';

import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../project';

export const sortProjects = sortWith<Pick<Project, 'name' | 'remoteId' | '_id'>>([
  descend(isDefaultProject),
  descend(isLocalProject),
  descend(isRemoteProject),
  ascend(prop('name')),
]);
