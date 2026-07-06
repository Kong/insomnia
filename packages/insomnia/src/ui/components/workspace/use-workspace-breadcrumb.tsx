import { models } from 'insomnia-data';
import { useMemo } from 'react';
import { useParams } from 'react-router';

import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import type { PaneBreadcrumb } from '~/ui/components/pane-header';
import { ResourceIcon } from '~/ui/components/workspace/resource-icon';
import { buildResourceUrl } from '~/ui/hooks/use-insomnia-navigation';

export function useWorkspaceBreadcrumbs() {
  const { activeWorkspace, activeProject, collection } = useWorkspaceLoaderData()!;
  const { activeRequest } = useRequestLoaderData() || {};
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const { organizationId } = useParams();
  const isMcp = activeWorkspace && models.workspace.isMcp(activeWorkspace);

  const resourcesById = useMemo(() => {
    const map = new Map<string, (typeof collection)[number]['doc']>();
    collection.forEach(item => {
      map.set(item.doc._id, item.doc);
    });
    return map;
  }, [collection]);

  const reqOrGrpId = activeRequest?._id || activeRequestGroup?._id;
  const reqOrGrp = collection.find(col => col.doc._id === reqOrGrpId);

  // workspace is not in collection, so we need to filter it out.
  const ancestors = useMemo(() => {
    if (!reqOrGrp?.ancestors) {
      return [];
    }
    return reqOrGrp.ancestors
      .map((id: string) => resourcesById.get(id))
      .filter(Boolean) as (typeof collection)[number]['doc'][];
  }, [reqOrGrp, resourcesById]);

  const breadcrumbs: PaneBreadcrumb[] = useMemo(() => {
    const crumbs: PaneBreadcrumb[] = [
      {
        id: 'project',
        label: activeProject.name,
        to: `/organization/${organizationId}/project/${activeProject._id}`,
        icon: <ResourceIcon resource={activeProject} />,
      },
    ];

    if (activeWorkspace) {
      crumbs.push({
        id: activeWorkspace._id,
        label: activeWorkspace.name,
        to: buildResourceUrl({
          organizationId: organizationId!,
          projectId: activeProject._id,
          workspaceId: activeWorkspace._id,
          resource: activeWorkspace,
        }),
        icon: <ResourceIcon resource={activeWorkspace} />,
      });
    }

    if (ancestors.length) {
      crumbs.push(
        ...ancestors.map(doc => ({
          id: doc!._id,
          label: doc!.name,
          to: buildResourceUrl({
            organizationId: organizationId!,
            projectId: activeProject._id,
            workspaceId: activeWorkspace!._id,
            resource: doc!,
          }),
          icon: <ResourceIcon resource={doc!} />,
        })),
      );
    }

    if (activeRequest && !isMcp) {
      crumbs.push({
        id: activeRequest._id,
        label: activeRequest.name || 'Untitled request',
        icon: <ResourceIcon resource={activeRequest} />,
      });
    } else if (activeRequestGroup) {
      crumbs.push({
        id: activeRequestGroup._id,
        label: activeRequestGroup.name || 'Untitled group',
        icon: <ResourceIcon resource={activeRequestGroup} />,
      });
    }

    return crumbs;
  }, [activeProject, activeWorkspace, ancestors, activeRequest, activeRequestGroup, organizationId, isMcp]);

  return breadcrumbs;
}
