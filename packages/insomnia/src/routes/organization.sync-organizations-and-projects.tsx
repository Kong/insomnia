import { useCallback } from 'react';
import { href, redirect, useFetcher } from 'react-router';

import { database } from '~/common/database';
import { project, userSession } from '~/models';
import { findPersonalOrganization, type Organization } from '~/models/organization';
import type { Project } from '~/models/project';
import { migrateProjectsUnderOrganization, syncOrganizations, syncProjects } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';
import { AsyncTask } from '~/utils/router';

import type { Route } from './+types/organization.sync-organizations-and-projects';

interface SyncOrgsAndProjectsActionRequest {
  organizationId: string;
  asyncTaskList: AsyncTask[];
  projectId?: string;
}

// this action is used to run task that we dont want to block the UI
export async function clientAction({ request }: Route.ClientActionArgs) {
  try {
    const {
      organizationId,
      projectId,
      asyncTaskList = [],
    } = (await request.json()) as SyncOrgsAndProjectsActionRequest;
    const { id: sessionId, accountId } = await userSession.getOrCreate();

    const taskPromiseList = [];
    if (asyncTaskList.includes(AsyncTask.SyncOrganization)) {
      invariant(sessionId, 'sessionId is required');
      invariant(accountId, 'accountId is required');
      taskPromiseList.push(syncOrganizations(sessionId, accountId));
    }

    if (asyncTaskList.includes(AsyncTask.MigrateProjects)) {
      const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
      invariant(organizations, 'Failed to fetch organizations.');
      const personalOrganization = findPersonalOrganization(organizations, accountId);
      invariant(personalOrganization, 'personalOrganization is required');
      invariant(personalOrganization.id, 'personalOrganizationId is required');
      invariant(sessionId, 'sessionId is required');
      taskPromiseList.push(migrateProjectsUnderOrganization(personalOrganization.id, sessionId));
    }

    if (asyncTaskList.includes(AsyncTask.SyncProjects)) {
      invariant(organizationId, 'organizationId is required');
      taskPromiseList.push(syncProjects(organizationId));
    }

    await Promise.all(taskPromiseList);

    // When user switch to a new organization, there is no project in db cache, we need to redirect to the first project after sync project
    if (!projectId && asyncTaskList.includes(AsyncTask.SyncProjects)) {
      const firstProject = await database.getWhere<Project>(project.type, { parentId: organizationId });
      if (firstProject?._id) {
        return redirect(
          href('/organization/:organizationId/project/:projectId', {
            organizationId,
            projectId: firstProject._id,
          }),
        );
      }
    }

    return {};
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log('Failed to run async task', error);
    return {
      error: errorMessage,
    };
  }
}

export function useSyncOrganizationsAndProjectsActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcher } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    function submit({
      organizationId,
      projectId,
      asyncTaskList,
    }: {
      organizationId: string;
      projectId?: string;
      asyncTaskList: AsyncTask[];
    }) {
      return fetcherSubmit(
        JSON.stringify({
          organizationId,
          projectId,
          asyncTaskList,
        }),
        {
          method: 'POST',
          action: '/organization/sync-organizations-and-projects',
          encType: 'application/json',
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcher,
    submit,
  };
}
