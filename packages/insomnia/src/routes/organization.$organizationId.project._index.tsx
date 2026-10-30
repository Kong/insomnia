import { models, services } from 'insomnia-data';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { getProjectsWithGitRepositories } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { logout } from '~/ui/account/session';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { MissingEntityRedirect } from '~/ui/components/missing-entity-redirect';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { useOrganizationStorageRule } from '~/ui/hooks/use-organization-storage-rule';
import { useDBQuery } from '~/ui/hooks/use-query';

const shouldAutoCreateInitialProject = async ({ accountId }: { accountId: string | null | undefined }) => {
  if (!accountId) {
    return false;
  }

  const firstAccountLandingKey = `firstAccountLandingHandled:${accountId}`;
  const legacyFirstPersonalOrgLandingKey = `firstPersonalOrgLandingHandled:${accountId}`;

  return (
    !window.localStorage.getItem(firstAccountLandingKey) &&
    !window.localStorage.getItem(legacyFirstPersonalOrgLandingKey)
  );
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const { id: sessionId, accountId } = await services.userSession.get();

  if (!sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  // Deliberately reads the database rather than the organization data cache: this route is where
  // the app lands right after deleting the last project, before the cache has heard about it.
  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = models.project.sortProjects(organizationProjects);
  // If there are projects in the organization and no project is selected, redirect to the first project
  if (projects.length > 0) {
    return redirect(`/organization/${organizationId}/project/${projects[0]._id}`);
  }

  let isFirstAccountLanding = false;

  try {
    isFirstAccountLanding = await shouldAutoCreateInitialProject({ accountId });
  } catch (error) {
    console.warn('[project] Failed to evaluate first account landing state', error);
  }

  if (isFirstAccountLanding) {
    try {
      const project = await services.project.create({
        name: 'Drafts',
        parentId: organizationId,
      });

      await services.workspace.create({
        name: 'My first collection',
        scope: 'collection',
        parentId: project._id,
      });

      return redirect(`/organization/${organizationId}/project/${project._id}?isExpanded=true`);
    } catch (error) {
      console.warn('[project] Failed to auto-create initial local project', error);
    }
  }

  // Reaching here means the organization has no projects and none was auto-created, so there is
  // nothing to hand the component — it renders the same empty view either way.
  return null;
}

/**
 * Default pane when no project is selected — typically an organization with no projects at all.
 * The sidebar and surrounding panels come from the parent
 * `organization.$organizationId.project` layout, which stays mounted when the first project
 * appears and this route hands over to `project.$projectId`.
 *
 * Leaves once the cached organization data has projects: the startup sync pulling the projects of
 * the landing organization, or a `TeamProjectChanged` event syncing in a project created elsewhere.
 * Both used to rely on an action (redirect, or the loader re-running after it); they are now
 * background tasks whose results only arrive through `db.changes`. It leaves through
 * `MissingEntityRedirect`, whose re-read confirms the projects first: a cache that still holds a
 * just-deleted last project turns empty and shows the form instead of bouncing back to it. The
 * target is `/organization/:organizationId`, which picks the project like every other landing.
 */
const Component = () => {
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const storageRules = useOrganizationStorageRule(organizationId);
  const { data: organizationData } = useDBQuery(organizationDataQuery(organizationId));

  return (
    <ErrorBoundary>
      {organizationData && organizationData.projects.length > 0 ? (
        <MissingEntityRedirect
          queryOptions={organizationDataQuery(organizationId)}
          getRedirectTo={() => href('/organization/:organizationId', { organizationId })}
        />
      ) : (
        <NoProjectView storageRules={storageRules} />
      )}
    </ErrorBoundary>
  );
};

export default Component;
