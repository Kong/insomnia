import { useMutationState } from '@tanstack/react-query';
import { models, services } from 'insomnia-data';
import { useEffect } from 'react';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useNavigate, useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { getProjectsWithGitRepositories } from '~/common/project';
import { invariant } from '~/common/utils/invariant';
import { useRootLoaderData } from '~/root';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { DelayedLoadingIndicator, MissingEntityRedirect } from '~/ui/components/missing-entity-redirect';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { useOrganizationStorageRule } from '~/ui/hooks/use-organization-storage-rule';
import { useDBMutation, useDBQuery } from '~/ui/hooks/use-query';
import { useStartupSyncStatus } from '~/ui/hooks/use-startup-sync';

const isFirstAccountLanding = (accountId: string | null | undefined) => {
  if (!accountId) {
    return false;
  }

  try {
    const firstAccountLandingKey = `firstAccountLandingHandled:${accountId}`;
    const legacyFirstPersonalOrgLandingKey = `firstPersonalOrgLandingHandled:${accountId}`;

    return (
      !window.localStorage.getItem(firstAccountLandingKey) &&
      !window.localStorage.getItem(legacyFirstPersonalOrgLandingKey)
    );
  } catch (error) {
    console.warn('[project] Failed to evaluate first account landing state', error);
    return false;
  }
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  // Deliberately reads the database rather than the organization data cache: this route is where
  // the app lands right after deleting the last project, before the cache has heard about it.
  const organizationProjects = await getProjectsWithGitRepositories({ organizationId });
  const projects = models.project.sortProjects(organizationProjects);
  // If there are projects in the organization and no project is selected, redirect to the first project
  if (projects.length > 0) {
    return redirect(`/organization/${organizationId}/project/${projects[0]._id}`);
  }

  // Reaching here means the organization has no projects locally. Its team projects may still be
  // syncing in the background; the component waits for that before deciding anything.
  return null;
}

/**
 * Creates the "Drafts" project with a first collection when an account lands for the first time in
 * an organization that has no projects, and opens it. Waits for the organization's startup sync to
 * succeed, as its team projects may not have arrived yet, and then checks the database rather than
 * the cache, which may not have heard about the synced projects yet. Once per organization and
 * session, like the startup sync.
 * Returns whether the empty view should keep waiting (the creation is pending or about to start).
 */
function useCreateInitialProject(organizationId: string, isSynced: boolean) {
  const navigate = useNavigate();
  const queryClient = useDBQueryClient();
  const { userSession } = useRootLoaderData()!;
  const shouldCreate = isSynced && isFirstAccountLanding(userSession.accountId);
  const mutationKey = createInitialProjectMutationKey(organizationId);
  const { mutate } = useDBMutation({
    mutationKey,
    mutationFn: async () => {
      if ((await services.project.count({ parentId: organizationId })) > 0) {
        return null;
      }
      const project = await services.project.create({ name: 'Drafts', parentId: organizationId });
      await services.workspace.create({ name: 'My first collection', scope: 'collection', parentId: project._id });
      return project;
    },
    onSuccess: project => {
      if (project) {
        navigate(`/organization/${organizationId}/project/${project._id}?isExpanded=true`);
      }
    },
    onError: error => console.warn('[project] Failed to auto-create initial local project', error),
    gcTime: Infinity,
  });
  // From the mutation cache, for the same StrictMode reason as `useStartupSyncStatus`.
  const statuses = useMutationState(
    { filters: { mutationKey, exact: true }, select: mutation => mutation.state.status },
    queryClient,
  );
  const status = statuses.at(-1) ?? 'idle';

  useEffect(() => {
    const hasRun = queryClient
      .getMutationCache()
      .find({ mutationKey: createInitialProjectMutationKey(organizationId), exact: true });
    if (shouldCreate && !hasRun) {
      mutate();
    }
  }, [mutate, organizationId, queryClient, shouldCreate]);

  return shouldCreate && (status === 'idle' || status === 'pending');
}

const createInitialProjectMutationKey = (organizationId: string) => ['create-initial-project', organizationId];

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
  // A failed sync shows the empty view; the sync indicator in the status bar offers the retry.
  const syncStatus = useStartupSyncStatus(organizationId);
  const isSyncing = syncStatus === 'pending';
  const isCreatingInitialProject = useCreateInitialProject(organizationId, syncStatus === 'success');

  return (
    <ErrorBoundary>
      {isSyncing || isCreatingInitialProject ? (
        <DelayedLoadingIndicator />
      ) : organizationData && organizationData.projects.length > 0 ? (
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
