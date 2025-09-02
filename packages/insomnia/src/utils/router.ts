import { href, matchPath, type PathMatch } from 'react-router';

import { database } from '../common/database';
import * as models from '../models';
import type { Organization } from '../models/organization';
import { findPersonalOrganization, SCRATCHPAD_ORGANIZATION_ID } from '../models/organization';
import { type Project, SCRATCHPAD_PROJECT_ID } from '../models/project';
import { scopeToActivity, SCRATCHPAD_WORKSPACE_ID } from '../models/workspace';
export const enum AsyncTask {
  SyncOrganization,
  MigrateProjects,
  SyncProjects,
}

const getMatchParams = (location: string) => {
  const workspaceMatch = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId',
      end: false,
    },
    location,
  );

  const projectMatch = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId',
      end: false,
    },
    location,
  );

  return (workspaceMatch || projectMatch) as PathMatch<'organizationId' | 'projectId' | 'workspaceId'> | null;
};

export const getInitialRouteForOrganization = async ({
  organizationId,
  navigateToWorkspace = false,
}: {
  organizationId: string;
  navigateToWorkspace?: boolean;
}) => {
  // 1. assuming we have history, try to redirect to the last visited project
  const prevOrganizationLocation = localStorage.getItem(`locationHistoryEntry:${organizationId}`);
  // Check if the last visited project exists and redirect to it
  if (prevOrganizationLocation) {
    const match = getMatchParams(prevOrganizationLocation);

    if (match && match.params.organizationId && match.params.projectId) {
      const existingProject = await models.project.getById(match.params.projectId);

      if (existingProject) {
        console.log('Redirecting to last visited project', existingProject._id);

        if (match.params.workspaceId && navigateToWorkspace) {
          const existingWorkspace = await models.workspace.getById(match.params.workspaceId);
          if (existingWorkspace) {
            return `${href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId`, {
              organizationId: match.params.organizationId,
              projectId: existingProject._id,
              workspaceId: existingWorkspace._id,
            })}/${scopeToActivity(existingWorkspace.scope)}`;
          }
        }

        return href(`/organization/:organizationId/project/:projectId`, {
          organizationId: match.params.organizationId,
          projectId: existingProject._id,
        });
      }
    }
  }
  // 2. if no history, redirect to the first project
  const firstProject = await database.findOne<Project>(models.project.type, { parentId: organizationId });

  if (firstProject?._id) {
    return href(`/organization/:organizationId/project/:projectId`, {
      organizationId,
      projectId: firstProject._id,
    });
  }
  // 3. if no project, redirect to the project route
  return href(`/organization/:organizationId/project`, {
    organizationId,
  });
};

export const getInitialEntry = async () => {
  // If the user has not seen the onboarding, then show it
  // Otherwise if the user is not logged in and has not logged in before, then show the login
  // Otherwise if the user is logged in, then show the organization
  try {
    const hasSeenOnboardingV11 = Boolean(window.localStorage.getItem('hasSeenOnboardingV11'));

    if (!hasSeenOnboardingV11) {
      return href('/onboarding/*', {
        '*': '',
      });
    }

    const hasUserLoggedInBefore = window.localStorage.getItem('hasUserLoggedInBefore');

    const user = await models.userSession.getOrCreate();
    if (user.id) {
      const organizations = JSON.parse(
        localStorage.getItem(`${user.accountId}:organizations`) || '[]',
      ) as Organization[];
      const personalOrganization = findPersonalOrganization(organizations, user.accountId);
      // If the personal org is not found in local storage go fetch from org index loader
      if (!personalOrganization) {
        return href('/organization');
      }

      let organizationId = personalOrganization.id;

      // Check if the user has a last visited organization
      try {
        const lastVisitedOrganizationId = localStorage.getItem('lastVisitedOrganizationId');
        if (lastVisitedOrganizationId && organizations.find(o => o.id === lastVisitedOrganizationId)) {
          organizationId = lastVisitedOrganizationId;
        }
      } catch (e) {}

      return {
        pathname: await getInitialRouteForOrganization({ organizationId, navigateToWorkspace: true }),
        state: {
          // async task need to execute when first entry
          asyncTaskList: [AsyncTask.SyncOrganization, AsyncTask.MigrateProjects, AsyncTask.SyncProjects],
        },
      };
    }

    if (hasUserLoggedInBefore) {
      return href('/auth/login');
    }

    return href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId: SCRATCHPAD_ORGANIZATION_ID,
      projectId: SCRATCHPAD_PROJECT_ID,
      workspaceId: SCRATCHPAD_WORKSPACE_ID,
    });
  } catch (e) {
    return href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
      organizationId: SCRATCHPAD_ORGANIZATION_ID,
      projectId: SCRATCHPAD_PROJECT_ID,
      workspaceId: SCRATCHPAD_WORKSPACE_ID,
    });
  }
};
