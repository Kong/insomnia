import type { Project } from 'insomnia-data';
import { useEffect, useMemo } from 'react';

import { getUnsyncedRemoteWorkspaces, type InsomniaFile } from '~/common/project';
import { useServerDataQueryClient } from '~/ui/context/app/server-data-context';
import uiEventBus, { CLOUD_SYNC_FILE_CHANGE } from '~/ui/event-bus';
import { useOrganizationData } from '~/ui/hooks/use-organization-data';
import { useServerQuery } from '~/ui/hooks/use-query';
import { getAllRemoteBackendProjectsOfOrg, groupRemoteFilesByProjectId } from '~/ui/utils/remote-projects';

const remoteBackendProjectsKey = (organizationId: string) => ['remote-backend-projects', organizationId] as const;

/**
 * Installs the one and only CLOUD_SYNC_FILE_CHANGE -> invalidate subscription for an organization's
 * remote backend projects. Mount this once at the org-scoped route that hosts every consumer (the
 * project route, parent of both the sidebar and the project view) — never per consumer.
 *
 * Centralizing it there (instead of inside useRemoteBackendProjects) buys a single subscription
 * regardless of how many components read the data. The default staleTime already refetches on
 * mount, but a consumer that stays mounted won't refetch on its own when the data changes remotely
 * (SSE) or after a local pull; this invalidation is what forces those live consumers to refresh.
 */
export function useRemoteBackendProjectsInvalidation(organizationId: string): void {
  const queryClient = useServerDataQueryClient();

  useEffect(() => {
    return uiEventBus.on(CLOUD_SYNC_FILE_CHANGE, () => {
      queryClient.invalidateQueries({ queryKey: remoteBackendProjectsKey(organizationId) });
    });
  }, [queryClient, organizationId]);
}

/**
 * The single source of truth for an organization's remote backend projects.
 *
 * This is server-backed (a network GraphQL query lives behind the IPC call), so it binds to the
 * server-data query client. The org-level key is shared by every consumer (project view + sidebar),
 * so TanStack Query dedupes them into one request and one cache entry. Refresh is event-driven and
 * owned by useRemoteBackendProjectsInvalidation — both remote changes (SSE) and local pulls emit
 * CLOUD_SYNC_FILE_CHANGE, which invalidates the query.
 */
export function useRemoteBackendProjects(organizationId: string) {
  const { data } = useServerQuery({
    queryKey: remoteBackendProjectsKey(organizationId),
    queryFn: () => getAllRemoteBackendProjectsOfOrg({ organizationId }),
    enabled: !!organizationId,
  });

  return data ?? [];
}

/**
 * Remote (unsynced) files grouped by local projectId. Does not diff against local workspaces —
 * callers apply `getUnsyncedRemoteWorkspaces` against the relevant project's workspaces.
 */
export function useUnsyncedFilesByProjectId(organizationId: string, projects: Project[]): Map<string, InsomniaFile[]> {
  const remoteBackendProjects = useRemoteBackendProjects(organizationId);
  return useMemo(
    () => groupRemoteFilesByProjectId(remoteBackendProjects, projects),
    [remoteBackendProjects, projects],
  );
}

/**
 * The unsynced remote files for a single project, already diffed against that project's local
 * workspaces. Recomputes reactively when the shared query refreshes or when local workspaces
 * change (via db.changes-backed useOrganizationData).
 */
export function useUnsyncedFilesForProject(organizationId: string, projectId: string): InsomniaFile[] {
  const { projects, workspaces } = useOrganizationData(organizationId);
  const filesByProjectId = useUnsyncedFilesByProjectId(organizationId, projects);

  return useMemo(() => {
    const files = filesByProjectId.get(projectId) ?? [];
    const projectWorkspaces = workspaces.filter(w => w.parentId === projectId);
    return getUnsyncedRemoteWorkspaces(files, projectWorkspaces);
  }, [filesByProjectId, workspaces, projectId]);
}
