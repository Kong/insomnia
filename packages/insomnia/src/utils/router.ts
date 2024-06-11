import { matchPath } from 'react-router-dom';

import { database } from '../common/database';
import * as models from '../models';
import { Organization } from '../models/organization';
import { findPersonalOrganization } from '../models/organization';
import { Project } from '../models/project';
import { AsyncTask } from '../ui/routes/organization';

// generate as complete a path as possible, reduce router redirects, and let all loader run parallel
export const getWholePath = async (accountId: string) => {
  const organizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];
  const personalOrganization = findPersonalOrganization(organizations, accountId);
  if (!personalOrganization) {
    return '/organization';
  }

  const personalOrganizationId = personalOrganization.id;
  // When org icon is clicked this ensures we remember the last visited page
  const prevOrganizationLocation = localStorage.getItem(
    `locationHistoryEntry:${personalOrganizationId}`
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
  const allOrganizationProjects = await database.find<Project>(models.project.type, {
    parentId: personalOrganizationId,
  }) || [];

  // Check if the org has any projects and redirect to the first one
  const projectId = allOrganizationProjects[0]?._id;

  if (!projectId) {
    return `/organization/${personalOrganizationId}/project`;
  }

  return `/organization/${personalOrganizationId}/project/${projectId}`;
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
      // return '/organization';
      const path = await getWholePath(user.accountId);
      return {
        pathname: path,
        state: {
          // async task need to excute when fisrt entry
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
