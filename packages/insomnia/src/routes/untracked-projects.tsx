import type { Organization } from 'insomnia-api';

import { database } from '~/common/database';
import { services } from '~/insomnia-data';
import { SCRATCHPAD_ORGANIZATION_ID } from '~/models/organization';
import type { Project } from '~/models/project';
import type { Workspace } from '~/models/workspace';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/untracked-projects';

export interface UntrackedProjectsLoaderData {
  untrackedProjects: (Project & { workspacesCount: number })[];
  untrackedWorkspaces: Workspace[];
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const { accountId } = await services.userSession.getOrCreate();
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
}

export const useUntrackedProjectsLoaderFetcher = createFetcherLoadHook(
  load => () => {
    return load('/untracked-projects');
  },
  clientLoader,
);
