import type { Organization } from 'insomnia-api';
import { services } from 'insomnia-data';
import { href, redirect } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { migrateProjectsUnderOrganization, syncOrganizations, syncProjects } from '~/ui/organization-utils';
import { AsyncTask, createFetcherSubmitHook } from '~/ui/utils/router';

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
    const { id: sessionId, accountId } = await services.userSession.get();

    const taskPromiseList = [];
    if (asyncTaskList.includes(AsyncTask.SyncOrganization)) {
      invariant(sessionId, 'sessionId is required');
      invariant(accountId, 'accountId is required');
      taskPromiseList.push(syncOrganizations(sessionId, accountId));
    }

    if (asyncTaskList.includes(AsyncTask.MigrateProjects)) {
      const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
      invariant(organizations.length, 'Failed to fetch organizations.');
      invariant(sessionId, 'sessionId is required');
      // TODO: when migrating to /v3/users/me/spaces, target the owned space with total_members === 1
      // so legacy orphan local projects land in the user's solo space rather than a shared owned space.
      taskPromiseList.push(migrateProjectsUnderOrganization(organizations[0].id, sessionId));
    }

    if (asyncTaskList.includes(AsyncTask.SyncProjects)) {
      invariant(organizationId, 'organizationId is required');
      taskPromiseList.push(syncProjects(organizationId));
    }

    await Promise.all(taskPromiseList);

    // When user switch to a new organization, there is no project in db cache, we need to redirect to the first project after sync project
    if (!projectId && asyncTaskList.includes(AsyncTask.SyncProjects)) {
      const firstProject = await services.project.get({ parentId: organizationId });
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

export const useSyncOrganizationsAndProjectsActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      asyncTaskList,
    }: {
      organizationId: string;
      projectId?: string;
      asyncTaskList: AsyncTask[];
    }) => {
      return submit(
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
  clientAction,
);
