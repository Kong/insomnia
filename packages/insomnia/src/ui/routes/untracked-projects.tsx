import type { LoaderFunction } from 'react-router-dom';

import { database } from '../../common/database';
import { userSession } from '../../models';
import { type Organization, SCRATCHPAD_ORGANIZATION_ID } from '../../models/organization';
import type { Project } from '../../models/project';
import type { Workspace } from '../../models/workspace';

export interface UntrackedProjectsLoaderData {
  untrackedProjects: (Project & { workspacesCount: number })[];
  untrackedWorkspaces: Workspace[];
}

export const loader: LoaderFunction = async () => {
  const { accountId } = await userSession.getOrCreate();
  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const listOfOrganizationIds = [...organizations.map(o => o.id), SCRATCHPAD_ORGANIZATION_ID];

  const projects = await database.find<Project>('Project', {
    parentId: { $nin: listOfOrganizationIds },
  });

  const untrackedProjects = [];

  for (const project of projects) {
    const workspacesCount = await database.count('Workspace', {
      parentId: project._id,
    });

    untrackedProjects.push({
      ...project,
      workspacesCount,
    });
  }

  const untrackedWorkspaces = await database.find<Workspace>('Workspace', {
    parentId: null,
  });

  return {
    untrackedProjects,
    untrackedWorkspaces,
  };
};
