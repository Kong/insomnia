import { matchPath } from 'react-router-dom';

import { database } from '../common/database';
import * as models from '../models';
import { Organization } from '../models/organization';
import { findPersonalOrganization } from '../models/organization';
import { Project } from '../models/project';
export const enum AsyncTask {
  SyncOrganization,
  MigrateProjects,
  SyncProjects,
}
export const getInitialRouteForOrganization = async (orgId: string) => {
  // 1. assuming we have history, try to redirect to the last visited project
  const prevOrganizationLocation = localStorage.getItem(
    `locationHistoryEntry:${orgId}`
  );
  // Check if the last visited project exists and redirect to it
  if (prevOrganizationLocation) {
    const match = matchPath(
      {
        path: '/organization/:organizationId/project/:projectId',
        end: false,
      },
      prevOrganizationLocation
    );

    if (match && match.params.organizationId && match.params.projectId) {
      const existingProject = await models.project.getById(match.params.projectId);

      if (existingProject) {
        console.log('Redirecting to last visited project', existingProject._id);
        return `/organization/${match?.params.organizationId}/project/${existingProject._id}`;
      }
    }
  }
  // 2. if no history, redirect to the first project
  const firstProject = await database.getWhere<Project>(models.project.type, { parentId: orgId });

  if (firstProject?._id) {
    return `/organization/${orgId}/project/${firstProject?._id}`;
  }
  // 3. if no project, redirect to the project route
  return `/organization/${orgId}/project`;
};

export const getInitialEntry = async () => {
  // If the user has not seen the onboarding, then show it
  // Otherwise if the user is not logged in and has not logged in before, then show the login
  // Otherwise if the user is logged in, then show the organization
  try {
    const hasSeenOnboardingV9 = Boolean(window.localStorage.getItem('hasSeenOnboardingV9'));

    if (!hasSeenOnboardingV9) {
      return '/onboarding';
    }

    const hasUserLoggedInBefore = window.localStorage.getItem('hasUserLoggedInBefore');

    const user = await models.userSession.getOrCreate();
    if (user.id) {
      const organizations = JSON.parse(localStorage.getItem(`${user.accountId}:organizations`) || '[]') as Organization[];
      const personalOrganization = findPersonalOrganization(organizations, user.accountId);
      // If the personal org is not found in local storage go fetch from org index loader
      if (!personalOrganization) {
        return '/organization';
      }
      const personalOrganizationId = personalOrganization.id;
      return {
        pathname: await getInitialRouteForOrganization(personalOrganizationId),
        state: {
          // async task need to excute when first entry
          asyncTaskList: [AsyncTask.SyncOrganization, AsyncTask.MigrateProjects, AsyncTask.SyncProjects],
        },
      };
    }

    if (hasUserLoggedInBefore) {
      return '/auth/login';
    }

    return '/organization/org_scratchpad/project/proj_scratchpad/workspace/wrk_scratchpad/debug';
  } catch (e) {
    return '/organization/org_scratchpad/project/proj_scratchpad/workspace/wrk_scratchpad/debug';
  }
};
