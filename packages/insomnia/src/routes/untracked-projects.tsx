import { useCallback } from 'react';
import { useFetcher } from 'react-router';

import { database } from '~/common/database';
import { userSession } from '~/models';
import { type Organization, SCRATCHPAD_ORGANIZATION_ID } from '~/models/organization';
import type { Project } from '~/models/project';
import type { Workspace } from '~/models/workspace';

import type { Route } from './+types/untracked-projects';

export interface UntrackedProjectsLoaderData {
  untrackedProjects: (Project & { workspacesCount: number })[];
  untrackedWorkspaces: Workspace[];
}

export async function clientLoader(_args: Route.ClientLoaderArgs) {
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
}

export function useUntrackedProjectsLoaderFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { load: fetcherLoad, ...fetcherRest } = useFetcher<typeof clientLoader>(args);

  const load = useCallback(() => {
    return fetcherLoad('/untracked-projects');
  }, [fetcherLoad]);

  return {
    ...fetcherRest,
    load,
  };
}
