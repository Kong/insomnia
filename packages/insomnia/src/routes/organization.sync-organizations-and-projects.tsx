import type { Organization } from 'insomnia-api';
import type { Project } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';
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
      invariant(organizations, 'Failed to fetch organizations.');
      const personalOrganization = models.organization.findPersonalOrganization(organizations, accountId);
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
      const firstProject = await database.findOne<Project>(models.project.type, { parentId: organizationId });
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
