import { href, useParams } from 'react-router';

import { organizationDataQuery } from '~/common/app-data';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { DelayedLoadingIndicator, MissingEntityRedirect } from '~/ui/components/missing-entity-redirect';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { useOrganizationStorageRule } from '~/ui/hooks/use-organization-storage-rule';
import { useDBQuery, useServerQuery } from '~/ui/hooks/use-query';
import { startupSyncQuery } from '~/ui/hooks/use-startup-sync';

/**
 * Default pane when no project is selected — an organization with no projects at all.
 * The sidebar and surrounding panels come from the parent
 * `organization.$organizationId.project` layout, which stays mounted when the first project
 * appears and this route hands over to `project.$projectId`.
 *
 * - While the organization's startup sync runs, its team projects may still be on their way, so it
 *   shows a delayed loading indicator rather than the "create a project" form. A failed sync shows
 *   the form; the sync indicator in the status bar offers the retry.
 * - Once the cached organization data has projects (the startup sync brought them in, a
 *   `TeamProjectChanged` event synced one, or the app navigated here with projects), it leaves
 *   through `MissingEntityRedirect`: the re-read first confirms the projects, so a cache that still
 *   holds a just-deleted last project shows the form instead of bouncing back to it. It opens the
 *   first-landing "Drafts" project the sync created, or lets `/organization/:organizationId` pick
 *   the project, like every other landing.
 */
const Component = () => {
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const storageRules = useOrganizationStorageRule(organizationId);
  // Also starts the startup sync when the organization layout hasn't yet: its effects run after
  // this route's.
  const { data: startupSync, isPending: isSyncing } = useServerQuery(startupSyncQuery(organizationId));
  const { data: organizationData } = useDBQuery(organizationDataQuery(organizationId));

  const getLandingRoute = ({ projects }: { projects: { _id: string }[] }) => {
    const initialProjectId = startupSync?.initialProjectId;
    if (initialProjectId && projects.some(project => project._id === initialProjectId)) {
      return `${href('/organization/:organizationId/project/:projectId', { organizationId, projectId: initialProjectId })}?isExpanded=true`;
    }
    return href('/organization/:organizationId', { organizationId });
  };

  return (
    <ErrorBoundary>
      {isSyncing || !organizationData ? (
        <DelayedLoadingIndicator />
      ) : organizationData.projects.length > 0 ? (
        <MissingEntityRedirect queryOptions={organizationDataQuery(organizationId)} getRedirectTo={getLandingRoute} />
      ) : (
        <NoProjectView storageRules={storageRules} />
      )}
    </ErrorBoundary>
  );
};

export default Component;
