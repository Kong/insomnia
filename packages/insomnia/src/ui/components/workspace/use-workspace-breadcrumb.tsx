import { models } from 'insomnia-data';
import { useMemo } from 'react';
import { useParams } from 'react-router';

import { Icon } from '~/basic-components/icon';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import type { PaneBreadcrumb } from '~/ui/components/pane-header';
import { ResourceIcon } from '~/ui/components/workspace/resource-icon';
import { useExampleQuery } from '~/ui/hooks/use-example-data';
import { buildResourceUrl, useInsomniaNavigation } from '~/ui/hooks/use-insomnia-navigation';

export function useWorkspaceBreadcrumbs() {
  const { activeWorkspace, activeProject, collection } = useWorkspaceLoaderData()!;
  const { activeRequest } = useRequestLoaderData() || {};
  const { activeRequestGroup } = useRequestGroupLoaderData() || {};
  const { organizationId, exampleId } = useParams();
  const { routeInfo } = useInsomniaNavigation();
  const isMcp = activeWorkspace && models.workspace.isMcp(activeWorkspace);
  const isRunner = routeInfo?.routeId === 'runner';
  const isExample = routeInfo?.routeId === 'example';
  const runnerFolderId = isRunner ? routeInfo.searchParams.get('folder') : null;
  // Examples are rendered by their own route (not nested under the request
  // route), so `useRequestLoaderData` is empty there; resolve the example and
  // its parent request from the app-data cache instead.
  const exampleQuery = useExampleQuery(exampleId ?? '', { enabled: isExample });
  const exampleData = isExample ? exampleQuery.data : undefined;

  const resourcesById = useMemo(() => {
    const map = new Map<string, (typeof collection)[number]['doc']>();
    collection.forEach(item => {
      map.set(item.doc._id, item.doc);
    });
    return map;
  }, [collection]);

  const runnerFolder = runnerFolderId ? collection.find(col => col.doc._id === runnerFolderId) : undefined;
  const folder = activeRequestGroup || runnerFolder?.doc;
  const reqOrGrpId = activeRequest?._id || folder?._id;
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
    } else if (exampleData) {
      crumbs.push({
        id: exampleData.parentRequest._id,
        label: exampleData.parentRequest.name || 'Untitled request',
        to: buildResourceUrl({
          organizationId: organizationId!,
          projectId: activeProject._id,
          workspaceId: activeWorkspace!._id,
          resource: exampleData.parentRequest,
        }),
        icon: <ResourceIcon resource={exampleData.parentRequest} />,
      }, {
        id: exampleData.example._id,
        label: exampleData.example.name || 'Untitled example',
        icon: <Icon icon="code" className="w-2.5 shrink-0" />,
      });
    } else if (folder) {
      crumbs.push({
        id: folder._id,
        label: folder.name || 'Untitled folder',
        to: isRunner
          ? buildResourceUrl({
              organizationId: organizationId!,
              projectId: activeProject._id,
              workspaceId: activeWorkspace!._id,
              resource: folder,
            })
          : undefined,
        icon: <ResourceIcon resource={folder} />,
      });
    }

    if (isRunner) {
      crumbs.push({
        id: 'runner',
        label: 'Runner',
        icon: <Icon icon="play" className="w-2.5 shrink-0" />,
      });
    }

    return crumbs;
  }, [
    activeProject,
    activeWorkspace,
    ancestors,
    activeRequest,
    folder,
    organizationId,
    isMcp,
    isRunner,
    exampleData,
  ]);

  return breadcrumbs;
}
