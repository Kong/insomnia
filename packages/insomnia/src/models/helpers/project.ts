import { ascend, descend, prop, sortWith } from 'ramda';

import { isDefaultProject, isLocalProject, isRemoteProject, Project } from '../project';

export const sortProjects = <T extends Pick<Project, 'name' | 'remoteId' | '_id'>>(projects: T[]) => sortWith<T>([
  descend(isDefaultProject),
  descend(isLocalProject),
  descend(isRemoteProject),
  ascend(prop('name')),
], projects);
