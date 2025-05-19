import { userSession } from 'insomnia-database/models';
import { type Organization, SCRATCHPAD_ORGANIZATION_ID } from 'insomnia-database/models/organization';
import type { Project } from 'insomnia-database/models/project';
import type { Workspace } from 'insomnia-database/models/workspace';
import type { LoaderFunction } from 'react-router';

import { database } from 'insomnia/src/common/database';

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
